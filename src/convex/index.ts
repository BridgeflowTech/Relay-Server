import { config } from "../config";
import axios from "axios";


async function convexMutation(functionName: string, args: any, nodeId: string) {
  const response = await fetch(`${config.convex.url}/api/mutation`, {
    method: "POST",
    headers: {
      "Authorization": `Convex ${config.convex.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: functionName,
      args: args,
      format:"json"
    })
  });
  const data = await response.json();
  return data;
}

async function convexQuery(functionPath: string, args: any) {
    const body = {
        path: functionPath,
        args: {"nodeId": args.nodeId},
        format:"json"
    }
    console.log(body)
    const response = await axios.post(`${config.convex.url}/api/query`, body, {
        headers: {
            "Content-Type": "application/json"
        }
    });
    const data = response.data;
    
    return data;
}


export { convexQuery, convexMutation };