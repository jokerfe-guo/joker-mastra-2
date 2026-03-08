import { Mastra } from '@mastra/core/mastra';
import { reportingAgent } from './agents/reporting-agent';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

export const mastra = new Mastra({
  agents: { reportingAgent },
  deployer: new CloudflareDeployer({
    name: 'joker-mastra-2',
    vars: {
      NODE_ENV: 'production',
    },
  }),
});
