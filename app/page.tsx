import { ChatTerminal } from "@/components/ChatTerminal";
import { MeshStatus } from "@/components/MeshStatus";

export default function Home() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 20px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, color: "var(--accent)" }}>XYNQ</h1>
        <p style={{ color: "#9ab5a8" }}>
          Free compute, forever. Inference served by a mesh of contributed GPUs —
          no account, no logging.
        </p>
      </header>

      <MeshStatus />
      <ChatTerminal />

      <footer style={{ marginTop: 48, color: "#5b7468", fontSize: 12 }}>
        OpenAI-compatible API at <code>/api/v1</code>. Contribute a GPU and earn
        $XYNQ.
      </footer>
    </main>
  );
}
