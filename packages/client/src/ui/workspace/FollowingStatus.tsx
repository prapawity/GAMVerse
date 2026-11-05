export function FollowingStatus({ targetName, onStop }: { targetName: string; onStop: () => void }) {
  return (
    <div className="social-alert follow-alert">
      <span className="social-alert-copy" role="status"><strong>Following {targetName}</strong></span>
      <button type="button" className="social-alert-action" onClick={onStop}>Stop following</button>
    </div>
  );
}
