/**
 * Pass on `<Link to={...} state={...} />` when opening `/company/:id`
 * so CompanyDetail can return to the correct list instead of hardcoding Universe.
 */
export type CompanyProfileBackState = {
  from: string;
  backLabel: string;
};

export const COMPANY_PROFILE_BACK = {
  universe: { from: "/universe", backLabel: "Back to Universe" },
  gptTargetUniverse: {
    from: "/gpt-target-universe",
    backLabel: "Back to GPT target universe",
  },
  screeningCampaigns: {
    from: "/screening-campaigns",
    backLabel: "Back to screening campaigns",
  },
  prospects: { from: "/prospects", backLabel: "Back to Prospects" },
} as const satisfies Record<string, CompanyProfileBackState>;

export function companyProfileBackToList(listId: string): CompanyProfileBackState {
  return {
    from: `/lists/${listId}`,
    backLabel: "Back to list",
  };
}

export function companyProfileBackToRunResults(runId: string): CompanyProfileBackState {
  return {
    from: `/ai/runs/${runId}/results`,
    backLabel: "Back to run results",
  };
}
