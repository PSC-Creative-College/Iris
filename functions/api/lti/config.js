import { json, ltiConfig } from "../../_shared/lti.js";

export async function onRequestGet({ request, env }) {
  return json(ltiConfig(request, env));
}
