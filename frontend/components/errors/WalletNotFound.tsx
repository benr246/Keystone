export default function WalletNotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded border-2 border-dashed border-oxide bg-paper-deep p-8 text-center">
      <p className="annotation mb-2">error / no. 01 — wallet not found</p>
      <h2 className="font-display text-2xl font-semibold">
        No Stellar wallet detected
      </h2>
      <p className="mt-3 text-sm text-ink-soft">
        Keystone needs a browser wallet to sign transactions. Install Freighter,
        then reload this page.
      </p>
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-block rounded bg-oxide px-5 py-2.5 font-medium text-paper hover:bg-oxide-deep"
      >
        Install Freighter
      </a>
    </div>
  );
}
