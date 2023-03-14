package scim

import (
	"context"
	"net/http"
	"strings"

	"github.com/elimity-com/scim"
	"github.com/elimity-com/scim/optional"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/enterprise"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/licensing"
	"github.com/sourcegraph/sourcegraph/internal/conf"
	"github.com/sourcegraph/sourcegraph/internal/conf/conftypes"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/observation"
)

type IdentityProvider string

const (
	SCIM_AZURE_AD IdentityProvider = "Azure AD"
	SCIM_STANDARD IdentityProvider = "STANDARD"
)

func getConfiguredIdentityProvider() IdentityProvider {
	value := conf.Get().ScimIdentityProvider
	switch value {
	case string(SCIM_AZURE_AD):
		return SCIM_AZURE_AD
	default:
		return SCIM_STANDARD
	}
}

type scimMiddleware func(next http.Handler) http.Handler

// Init sets SCIMHandler to a real handler.
func Init(ctx context.Context, observationCtx *observation.Context, db database.DB, _ codeintel.Services, _ conftypes.UnifiedWatchable, s *enterprise.Services) error {
	s.SCIMHandler = newHandler(ctx, db, observationCtx)

	return nil
}

// newHandler creates and returns a new SCIM 2.0 handler.
func newHandler(ctx context.Context, db database.DB, observationCtx *observation.Context) http.Handler {
	config := scim.ServiceProviderConfig{
		DocumentationURI: optional.NewString("docs.sourcegraph.com/admin/scim"),
		MaxResults:       100,
		SupportFiltering: true,
		SupportPatch:     true,
		AuthenticationSchemes: []scim.AuthenticationScheme{
			{
				Type:             scim.AuthenticationTypeOauthBearerToken,
				Name:             "OAuth Bearer Token",
				Description:      "Authentication scheme using the Bearer Token standard – use the key 'scim.authToken' in the site config to set the token.",
				SpecURI:          optional.NewString("https://tools.ietf.org/html/rfc6750"),
				DocumentationURI: optional.NewString("docs.sourcegraph.com/admin/scim"),
				Primary:          true,
			},
		},
	}

	var userResourceHandler = NewUserResourceHandler(ctx, observationCtx, db)

	resourceTypes := []scim.ResourceType{createUserResourceType(userResourceHandler)}

	server := scim.Server{
		Config:        config,
		ResourceTypes: resourceTypes,
	}

	return scimAuthMiddleware(scimLicenseCheckMiddleware(scimRewriteMiddleware(server)))
}

func scimAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := conf.Get().ScimAuthToken
		if len(token) == 0 || token != strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func scimLicenseCheckMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		licenseError := licensing.Check(licensing.FeatureSCIM)
		if licenseError != nil {
			http.Error(w, licenseError.Error(), http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func scimRewriteMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/.api/scim")
		next.ServeHTTP(w, r)
	})
}
