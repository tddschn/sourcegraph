package shared

import (
	"context"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/licensing"
	ossDB "github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/extsvc"
	"github.com/sourcegraph/sourcegraph/internal/repos"
	"github.com/sourcegraph/sourcegraph/internal/types"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

// enterpriseCreateRepoHook enforces licences checks which may prevent a repository from being created.
func enterpriseCreateRepoHook(ctx context.Context, s repos.Store, repo *types.Repo) error {
	if err := enterpriseCreateRepoHook_FeaturePrivateRepositories(ctx, s, repo); err != nil {
		return err
	}

	return nil
}

// enterpriseUpdateRepoHook checks if there is still room for private repositories
// available in the applied license before updating a repository from public to private,
// or undeleting a private repository.
func enterpriseUpdateRepoHook(ctx context.Context, s repos.Store, existingRepo *types.Repo, newRepo *types.Repo) error {
	if err := enterpriseUpdateRepoHook_FeaturePrivateRepositories(ctx, s, existingRepo, newRepo); err != nil {
		return err
	}

	return nil
}

// enterpriseCreateRepoHook_FeaturePrivateRepositories checks if there is
// still room for private repositories available in the applied license before
// creating a new private repository.
func enterpriseCreateRepoHook_FeaturePrivateRepositories(ctx context.Context, s repos.Store, repo *types.Repo) error {
	// If the repository is public, we don't have to check anything
	if !repo.Private {
		return nil
	}

	var prFeature licensing.FeaturePrivateRepositories
	if err := licensing.Check(&prFeature); err != nil {
		return err
	}

	if prFeature.Unrestricted {
		return nil
	}

	numPrivateRepos, err := s.RepoStore().Count(ctx, ossDB.ReposListOptions{OnlyPrivate: true})
	if err != nil {
		return err
	}

	if numPrivateRepos >= prFeature.MaxNumPrivateRepos {
		return errors.Newf("maximum number of private repositories included in license (%d) reached", prFeature.MaxNumPrivateRepos)
	}

	return nil
}

// enterpriseUpdateRepoHook_FeaturePrivateRepositories checks if there is
// still room for private repositories available in the applied license before
// updating a repository from public to private, or undeleting a private
// repository.
func enterpriseUpdateRepoHook_FeaturePrivateRepositories(ctx context.Context, s repos.Store, existingRepo *types.Repo, newRepo *types.Repo) error {
	// If it is being updated to a public repository, or if a repository is being deleted, we don't have to check anything
	if !newRepo.Private || !newRepo.DeletedAt.IsZero() {
		return nil
	}

	var prFeature licensing.FeaturePrivateRepositories
	if err := licensing.Check(&prFeature); err != nil {
		return err
	}

	if prFeature.Unrestricted {
		return nil
	}

	numPrivateRepos, err := s.RepoStore().Count(ctx, ossDB.ReposListOptions{OnlyPrivate: true})
	if err != nil {
		return err
	}

	if numPrivateRepos > prFeature.MaxNumPrivateRepos {
		return errors.Newf("maximum number of private repositories included in license (%d) reached", prFeature.MaxNumPrivateRepos)
	} else if numPrivateRepos == prFeature.MaxNumPrivateRepos {
		// If the repository is already private, we don't have to check anything
		newPrivateRepo := (!existingRepo.DeletedAt.IsZero() || !existingRepo.Private) && newRepo.Private // If restoring a deleted repository, or if it was a public repository, and is now private
		if newPrivateRepo {
			return errors.Newf("maximum number of private repositories included in license (%d) reached", prFeature.MaxNumPrivateRepos)
		}
	}

	return nil
}

// TODO enterpriseCreateRepoHook_FeaturePrivateRepositories checks if there is
// still room for private repositories available in the applied license before
// creating a new private repository.
func enterpriseCreateRepoHook_FeatureRemoteRepositories(ctx context.Context, s repos.Store, repo *types.Repo) error {
	// If the repository is not remote it doesn't count towards remote limits.
	// TODO more robust check living somewhere that makes sense
	if repo.ExternalRepo.ServiceType == extsvc.TypeOther {
		return nil
	}

	var feat licensing.FeatureRemoteRepositories
	if err := licensing.Check(&feat); err != nil {
		return err
	}

	if feat.Unrestricted {
		return nil
	}

	// TODO need to add a robust check here. Thinking of a way to list "remote" other external services?

	numRemoteRepos, err := s.RepoStore().Count(ctx, ossDB.ReposListOptions{OnlyPrivate: true})
	if err != nil {
		return err
	}

	if numPrivateRepos >= prFeature.MaxNumPrivateRepos {
		return errors.Newf("maximum number of private repositories included in license (%d) reached", prFeature.MaxNumPrivateRepos)
	}

	return nil
}
