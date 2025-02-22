package autoindexing

import (
	"context"
	"time"

	otlog "github.com/opentracing/opentracing-go/log"
	"github.com/sourcegraph/log"
	"go.opentelemetry.io/otel/attribute"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/autoindexing/internal/enqueuer"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/autoindexing/internal/inference"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/autoindexing/internal/jobselector"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/autoindexing/internal/store"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/autoindexing/shared"
	uploadsshared "github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/uploads/shared"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/authz"
	"github.com/sourcegraph/sourcegraph/internal/codeintel/dependencies"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/gitserver"
	"github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/lib/codeintel/autoindex/config"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

type Service struct {
	store           store.Store
	repoStore       database.RepoStore
	inferenceSvc    InferenceService
	gitserverClient gitserver.Client
	indexEnqueuer   *enqueuer.IndexEnqueuer
	jobSelector     *jobselector.JobSelector
	logger          log.Logger
	operations      *operations
}

func newService(
	observationCtx *observation.Context,
	store store.Store,
	inferenceSvc InferenceService,
	repoUpdater RepoUpdaterClient,
	repoStore database.RepoStore,
	gitserverClient gitserver.Client,
) *Service {
	// NOTE - this should go up a level in init.go.
	// Not going to do this now so that we don't blow up all of the
	// tests (which have pretty good coverage of the whole service).
	// We should rewrite/transplant tests to the closest package that
	// provides that behavior and then mock the dependencies in the
	// glue packages.

	jobSelector := jobselector.NewJobSelector(
		store,
		repoStore,
		inferenceSvc,
		gitserverClient,
		log.Scoped("autoindexing job selector", ""),
	)

	indexEnqueuer := enqueuer.NewIndexEnqueuer(
		observationCtx,
		store,
		repoUpdater,
		repoStore,
		gitserverClient,
		jobSelector,
	)

	return &Service{
		store:           store,
		repoStore:       repoStore,
		inferenceSvc:    inferenceSvc,
		gitserverClient: gitserverClient,
		indexEnqueuer:   indexEnqueuer,
		jobSelector:     jobSelector,
		logger:          observationCtx.Logger,
		operations:      newOperations(observationCtx),
	}
}

func (s *Service) GetIndexConfigurationByRepositoryID(ctx context.Context, repositoryID int) (shared.IndexConfiguration, bool, error) {
	return s.store.GetIndexConfigurationByRepositoryID(ctx, repositoryID)
}

// InferIndexConfiguration looks at the repository contents at the latest commit on the default branch of the given
// repository and determines an index configuration that is likely to succeed.
func (s *Service) InferIndexConfiguration(ctx context.Context, repositoryID int, commit string, localOverrideScript string, bypassLimit bool) (_ *config.IndexConfiguration, _ []config.IndexJobHint, err error) {
	ctx, trace, endObservation := s.operations.inferIndexConfiguration.With(ctx, &err, observation.Args{
		LogFields: []otlog.Field{
			otlog.Int("repositoryID", repositoryID),
		},
	})
	defer endObservation(1, observation.Args{})

	repo, err := s.repoStore.Get(ctx, api.RepoID(repositoryID))
	if err != nil {
		return nil, nil, err
	}

	if commit == "" {
		var ok bool
		commit, ok, err = s.gitserverClient.Head(ctx, authz.DefaultSubRepoPermsChecker, repo.Name)
		if err != nil || !ok {
			return nil, nil, errors.Wrapf(err, "gitserver.Head: error resolving HEAD for %d", repositoryID)
		}
	} else {
		exists, err := s.gitserverClient.CommitExists(ctx, authz.DefaultSubRepoPermsChecker, repo.Name, api.CommitID(commit))
		if err != nil {
			return nil, nil, errors.Wrapf(err, "gitserver.CommitExists: error checking %s for %d", commit, repositoryID)
		}

		if !exists {
			return nil, nil, errors.Newf("revision %s not found for %d", commit, repositoryID)
		}
	}
	trace.AddEvent("found", attribute.String("commit", commit))

	indexJobs, err := s.InferIndexJobsFromRepositoryStructure(ctx, repositoryID, commit, localOverrideScript, bypassLimit)
	if err != nil {
		return nil, nil, err
	}

	indexJobHints, err := s.jobSelector.InferIndexJobHintsFromRepositoryStructure(ctx, repo.Name, commit)
	if err != nil {
		return nil, nil, err
	}

	if len(indexJobs) == 0 {
		return nil, indexJobHints, nil
	}

	return &config.IndexConfiguration{
		IndexJobs: indexJobs,
	}, indexJobHints, nil
}

func (s *Service) UpdateIndexConfigurationByRepositoryID(ctx context.Context, repositoryID int, data []byte) error {
	return s.store.UpdateIndexConfigurationByRepositoryID(ctx, repositoryID, data)
}

func (s *Service) QueueRepoRev(ctx context.Context, repositoryID int, rev string) error {
	return s.store.QueueRepoRev(ctx, repositoryID, rev)
}

func (s *Service) SetInferenceScript(ctx context.Context, script string) error {
	return s.store.SetInferenceScript(ctx, script)
}

func (s *Service) GetInferenceScript(ctx context.Context) (string, error) {
	return s.store.GetInferenceScript(ctx)
}

func (s *Service) QueueIndexes(ctx context.Context, repositoryID int, rev, configuration string, force, bypassLimit bool) ([]uploadsshared.Index, error) {
	return s.indexEnqueuer.QueueIndexes(ctx, repositoryID, rev, configuration, force, bypassLimit)
}

func (s *Service) QueueIndexesForPackage(ctx context.Context, pkg dependencies.MinimialVersionedPackageRepo, assumeSynced bool) error {
	return s.indexEnqueuer.QueueIndexesForPackage(ctx, pkg, assumeSynced)
}

func (s *Service) InferIndexJobsFromRepositoryStructure(ctx context.Context, repositoryID int, commit string, localOverrideScript string, bypassLimit bool) ([]config.IndexJob, error) {
	return s.jobSelector.InferIndexJobsFromRepositoryStructure(ctx, repositoryID, commit, localOverrideScript, bypassLimit)
}

func IsLimitError(err error) bool {
	return errors.As(err, &inference.LimitError{})
}

func (s *Service) GetRepositoriesForIndexScan(ctx context.Context, processDelay time.Duration, allowGlobalPolicies bool, repositoryMatchLimit *int, limit int, now time.Time) ([]int, error) {
	return s.store.GetRepositoriesForIndexScan(ctx, processDelay, allowGlobalPolicies, repositoryMatchLimit, limit, now)
}

func (s *Service) RepositoryIDsWithConfiguration(ctx context.Context, offset, limit int) ([]uploadsshared.RepositoryWithAvailableIndexers, int, error) {
	return s.store.RepositoryIDsWithConfiguration(ctx, offset, limit)
}

func (s *Service) GetLastIndexScanForRepository(ctx context.Context, repositoryID int) (*time.Time, error) {
	return s.store.GetLastIndexScanForRepository(ctx, repositoryID)
}
