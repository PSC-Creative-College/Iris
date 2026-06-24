import { json, ltiPublicJwks } from "../../_shared/lti.js";

export async function onRequestGet({ env }) {
  return json(ltiPublicJwks(env));
}
