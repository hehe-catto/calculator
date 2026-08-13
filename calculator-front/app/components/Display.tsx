type DisplayProps = {
  expression: string;
  entry: string;
  loading: boolean;
};

export const Display = ({ expression, entry, loading }: DisplayProps) => (
  <div className="display" aria-busy={loading}>
    <div className="display-expression">{expression || " "}</div>
    <div className="display-entry">{entry}</div>
  </div>
);
