import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@aws-sdk/client-s3"],
};

export default config;
