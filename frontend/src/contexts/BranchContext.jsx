import { createContext, useContext } from "react";

const BranchContext = createContext(null);

const NOOP_BRANCH = {
  branches: [],
  selectedBranchId: null,
  currentBranch: null,
  selectBranch: () => {},
  reloadBranches: () => Promise.resolve(),
};

export const BranchProvider = ({ children }) => {
  return (
    <BranchContext.Provider value={NOOP_BRANCH}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
};

export default BranchContext;
