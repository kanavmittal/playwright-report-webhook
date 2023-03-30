/* eslint-disable no-use-before-define */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable import/no-extraneous-dependencies */
import {
  WebClient,
  KnownBlock,
  Block,
  ChatPostMessageResponse,
  LogLevel,
} from '@slack/web-api';
import axios from 'axios';
import { SummaryResults } from '.';
import generateBlocks from './LayoutGenerator';

export type additionalInfo = Array<{ key: string; value: string }>;

export default class SlackClient {
  private slackWebClient: WebClient;

  constructor(slackClient: WebClient) {
    this.slackWebClient = slackClient;
  }

  async sendMessage({
    options,
  }: {
    options: {
      channelIds: Array<string>;
      customLayout: Function | undefined;
      customLayoutAsync: Function | undefined;
      fakeRequest?: Function;
      maxNumberOfFailures: number;
      slackOAuthToken?: string;
      slackLogLevel?: LogLevel;
      summaryResults: SummaryResults;
    };
  }): Promise<Array<{ channel: string; outcome: string }>> {
    let blocks: (Block | KnownBlock)[];
    if (options.customLayout) {
      blocks = options.customLayout(options.summaryResults);
    } else if (options.customLayoutAsync) {
      blocks = await options.customLayoutAsync(options.summaryResults);
    } else {
      blocks = await generateBlocks(options.summaryResults, options.maxNumberOfFailures);
    }
    if (!options.channelIds) {
      throw new Error(`Channel ids [${options.channelIds}] is not valid`);
    }

    const result = [];
    for (const channel of options.channelIds) {
      let chatResponse: ChatPostMessageResponse;
      try {
        // under test
        if (options.fakeRequest) {
          chatResponse = await options.fakeRequest();
        } else {
          // send request for reals
          chatResponse = await this.doPostRequest(blocks);
        }
        if (chatResponse.ok) {
          result.push({ channel, outcome: `✅ Message sent to ${channel}` });
          // eslint-disable-next-line no-console
          console.log(`✅ Message sent to ${channel}`);
        } else {
          result.push({ channel, outcome: `❌ Message not sent to ${channel} \r\n ${chatResponse.message}` });
        }
      } catch (error: any) {
        result.push({
          channel,
          outcome: `❌ Message not sent to ${channel} \r\n ${error.message}`,
        });
      }
    }
    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  async doPostRequest(
    blocks: Array<KnownBlock | Block>,
  ): Promise<any> {
    const chatResponse = await axios.post(process.env.SLACK_WEBHOOK_URL, {
      blocks,
    });
    return chatResponse;
  }
}
