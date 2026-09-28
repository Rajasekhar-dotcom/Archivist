export type RefreshType = 'update_stats' | 'add_faq' | 'rewrite_intro';
export type RefreshSelections = Record<string, RefreshType>;

const globalStore = globalThis as typeof globalThis & {
  __archivistRefreshes?: RefreshSelections;
};

export function setRefreshes(refreshes: RefreshSelections) {
  globalStore.__archivistRefreshes = { ...refreshes };
}

export function getRefreshes() {
  return globalStore.__archivistRefreshes || {};
}
