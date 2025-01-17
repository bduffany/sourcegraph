package resolvers

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/backend"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/campaigns/resolvers/apitest"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/campaigns/store"
	ct "github.com/sourcegraph/sourcegraph/enterprise/internal/campaigns/testing"
	"github.com/sourcegraph/sourcegraph/internal/campaigns"
	"github.com/sourcegraph/sourcegraph/internal/db"
	"github.com/sourcegraph/sourcegraph/internal/db/dbconn"
	"github.com/sourcegraph/sourcegraph/internal/db/dbtesting"
	"github.com/sourcegraph/sourcegraph/internal/types"
)

func TestChangesetApplyPreviewConnectionResolver(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}

	ctx := backend.WithAuthzBypass(context.Background())
	dbtesting.SetupGlobalTestDB(t)

	userID := ct.CreateTestUser(t, false).ID

	cstore := store.New(dbconn.Global)

	campaignSpec := &campaigns.CampaignSpec{
		UserID:          userID,
		NamespaceUserID: userID,
	}
	if err := cstore.CreateCampaignSpec(ctx, campaignSpec); err != nil {
		t.Fatal(err)
	}

	esStore := db.NewExternalServicesStoreWith(cstore)
	repoStore := db.NewRepoStoreWith(cstore)

	rs := make([]*types.Repo, 0, 3)
	for i := 0; i < cap(rs); i++ {
		name := fmt.Sprintf("github.com/sourcegraph/test-changeset-apply-preview-connection-repo-%d", i)
		r := newGitHubTestRepo(name, newGitHubExternalService(t, esStore))
		if err := repoStore.Create(ctx, r); err != nil {
			t.Fatal(err)
		}
		rs = append(rs, r)
	}

	changesetSpecs := make([]*campaigns.ChangesetSpec, 0, len(rs))
	for i, r := range rs {
		repoID := graphqlbackend.MarshalRepositoryID(r.ID)
		s, err := campaigns.NewChangesetSpecFromRaw(ct.NewRawChangesetSpecGitBranch(repoID, fmt.Sprintf("d34db33f-%d", i)))
		if err != nil {
			t.Fatal(err)
		}
		s.CampaignSpecID = campaignSpec.ID
		s.UserID = userID
		s.RepoID = r.ID

		if err := cstore.CreateChangesetSpec(ctx, s); err != nil {
			t.Fatal(err)
		}

		changesetSpecs = append(changesetSpecs, s)
	}

	s, err := graphqlbackend.NewSchema(&Resolver{store: cstore}, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	apiID := string(marshalCampaignSpecRandID(campaignSpec.RandID))

	tests := []struct {
		first int

		wantTotalCount  int
		wantHasNextPage bool
	}{
		{first: 1, wantTotalCount: 3, wantHasNextPage: true},
		{first: 2, wantTotalCount: 3, wantHasNextPage: true},
		{first: 3, wantTotalCount: 3, wantHasNextPage: false},
	}

	for _, tc := range tests {
		input := map[string]interface{}{"campaignSpec": apiID, "first": tc.first}
		var response struct{ Node apitest.CampaignSpec }
		apitest.MustExec(ctx, t, s, input, &response, queryChangesetApplyPreviewConnection)

		specs := response.Node.ApplyPreview
		if diff := cmp.Diff(tc.wantTotalCount, specs.TotalCount); diff != "" {
			t.Fatalf("first=%d, unexpected total count (-want +got):\n%s", tc.first, diff)
		}

		if diff := cmp.Diff(tc.wantHasNextPage, specs.PageInfo.HasNextPage); diff != "" {
			t.Fatalf("first=%d, unexpected hasNextPage (-want +got):\n%s", tc.first, diff)
		}
	}

	var endCursor *string
	for i := range changesetSpecs {
		input := map[string]interface{}{"campaignSpec": apiID, "first": 1}
		if endCursor != nil {
			input["after"] = *endCursor
		}
		wantHasNextPage := i != len(changesetSpecs)-1

		var response struct{ Node apitest.CampaignSpec }
		apitest.MustExec(ctx, t, s, input, &response, queryChangesetApplyPreviewConnection)

		specs := response.Node.ApplyPreview
		if diff := cmp.Diff(1, len(specs.Nodes)); diff != "" {
			t.Fatalf("unexpected number of nodes (-want +got):\n%s", diff)
		}

		if diff := cmp.Diff(len(changesetSpecs), specs.TotalCount); diff != "" {
			t.Fatalf("unexpected total count (-want +got):\n%s", diff)
		}

		if diff := cmp.Diff(wantHasNextPage, specs.PageInfo.HasNextPage); diff != "" {
			t.Fatalf("unexpected hasNextPage (-want +got):\n%s", diff)
		}

		endCursor = specs.PageInfo.EndCursor
		if want, have := wantHasNextPage, endCursor != nil; have != want {
			t.Fatalf("unexpected endCursor existence. want=%t, have=%t", want, have)
		}
	}
}

const queryChangesetApplyPreviewConnection = `
query($campaignSpec: ID!, $first: Int!, $after: String) {
  node(id: $campaignSpec) {
    __typename

    ... on CampaignSpec {
      id

      applyPreview(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage, endCursor }
        nodes {
          __typename
        }
      }
    }
  }
}
`
