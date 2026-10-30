import test from "node:test";
import assert from "node:assert/strict";
import { awaitingClientApproval, needsTradeResponse } from "../src/lib/variationStatus";
import type { ChangeRequest } from "../src/types/project";

const variation = (type: ChangeRequest["type"], status: ChangeRequest["status"]) =>
  ({ type, status }) as ChangeRequest;

test("only pending client-request variations need a trade response", () => {
  assert.equal(needsTradeResponse(variation("client_request", "pending")), true);
  assert.equal(needsTradeResponse(variation("client_request", "approved")), false);
  assert.equal(needsTradeResponse(variation("client_request", "awaiting_client")), false);
  assert.equal(needsTradeResponse(variation("extra", "pending")), false);
});

test("trade and client action states remain distinct for combined attention counts", () => {
  const needTrade = variation("client_request", "pending");
  const awaitingClient = variation("addition", "pending");
  assert.equal(needsTradeResponse(needTrade) || awaitingClientApproval(needTrade), true);
  assert.equal(needsTradeResponse(awaitingClient) || awaitingClientApproval(awaitingClient), true);
  assert.equal(needsTradeResponse(awaitingClient), false);
});
