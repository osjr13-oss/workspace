import { createFlagsDiscoveryEndpoint } from "flags/next";
import * as flags from "@/flags";

export const GET = createFlagsDiscoveryEndpoint(flags, {
  secret: process.env.FLAGS_SECRET,
});
