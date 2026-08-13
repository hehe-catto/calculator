type ErrorMessageProps = {
  message: string | null;
};

// The region is always rendered so the live region is stable and the keypad
// does not shift when a message appears.
export const ErrorMessage = ({ message }: ErrorMessageProps) => (
  <div className="error-region" role="alert">
    {message ? <span className="error-text">{message}</span> : null}
  </div>
);
