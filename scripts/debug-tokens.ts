
import { TraceAnalyzer } from "../packages/agent-service/src/monitor/analyzer";
import { config } from "../packages/agent-service/src/config";

async function main() {
    const tracePath = "packages/agent-service/logs/traces.jsonl";
    console.log("Trace path:", tracePath);
    const analyzer = new TraceAnalyzer(tracePath);
    const traces = await analyzer.getAllTraces();
    console.log("Total Traces Found:", traces.length);
    if (traces.length > 0) {
        console.log("First Trace:", JSON.stringify(traces[0]));
    }

    const stats = await analyzer.getTokenStats();
    console.log("Token Stats:", JSON.stringify(stats, null, 2));
}

main();
