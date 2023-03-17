package shared

import (
	"context"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/licensing"
	ossDB "github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/repos"
	"github.com/sourcegraph/sourcegraph/internal/types"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

// enterpriseCreateRepoHook checks if there is still room for private repositories
// available in the applied license before creating a new private repository.
func enterpriseCreateRepoHook(ctx context.Context, s repos.Store, repo *types.Repo) error {
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

// enterpriseUpdateRepoHook checks if there is still room for private repositories
// available in the applied license before updating a repository from public to private,
// or undeleting a private repository.
func enterpriseUpdateRepoHook(ctx context.Context, s repos.Store, existingRepo *types.Repo, newRepo *types.Repo) error {
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
