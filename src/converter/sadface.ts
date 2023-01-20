import { Struct } from "@bufbuild/protobuf";
import { uuid, version as argServicesVersion } from "arg-services";
import * as model from "arg-services/graph/v1/graph_pb";
import { Edge, Graph, Node } from "../schema/sadface.js";
import * as date from "../services/date.js";

export function edgeFromSadface(obj: Edge): model.Edge {
  return new model.Edge({
    source: obj.source_id,
    target: obj.target_id,
    metadata: {},
  });
}

export function edgeToSadface(e: model.Edge, id: string): Edge {
  return {
    id: id,
    source_id: e.source,
    target_id: e.target,
  };
}

export function nodeToSadface(n: model.Node, id: string): Node {
  if (n.type.case === "atom") {
    return {
      id: id,
      metadata: {},
      sources: [],
      text: n.type.value.text,
      type: "atom",
    };
  } else if (n.type.case === "scheme") {
    return {
      id: id,
      metadata: {},
      name:
        n.type.value.type.case === undefined
          ? "undefined"
          : n.type.value.type.case,
      type: "scheme",
    };
  }

  throw new Error("Node type not supported");
}

export function nodeFromSadface(obj: Node): model.Node {
  if (obj.type === "atom") {
    const atomNode = new model.Node({
      type: {
        case: "atom",
        value: {
          text: obj.text,
        },
      },
      metadata: {
        created: undefined,
        updated: undefined,
      },
      userdata: obj.metadata,
    });
    return atomNode;
  } else {
    var schemeType: any = {
      value: undefined,
      case: undefined,
    };
    if (obj.name === "conflict" || obj.name === "attack") {
      schemeType.value = model.Attack.DEFAULT;
      schemeType.case = "attack";
    } else if (obj.name === "support") {
      schemeType.value = model.Support.DEFAULT;
      schemeType.case = "support";
    } else if (obj.name === "rephrase") {
      schemeType.value = model.Rephrase.DEFAULT;
      schemeType.case = "rephrase";
    } else if (obj.name === "preference") {
      schemeType.value = model.Preference.DEFAULT;
      schemeType.case = "preference";
    }
    const schemeNode = new model.Node({
      type: {
        case: "scheme",
        value: {
          premiseDescriptors: [],
          type: schemeType,
        },
      },
      metadata: {
        created: undefined,
        updated: undefined,
      },
      userdata: obj.metadata,
    });
    return schemeNode;
  }
}

export function toSadface(obj: model.Graph): Graph {
  let g: Graph = {
    nodes: [],
    edges: [],
    metadata: {
      core: {
        analyst_email: obj.analysts[0]?.email,
        analyst_name: obj.analysts[0]?.name,
        created: obj.metadata?.created?.toDate().toString(),
        edited: obj.metadata?.updated?.toDate().toString(),
        description: "",
        id: "",
        notes: "",
        title: "",
        version: "",
      },
    },
  };
  // Add nodes
  Object.entries(obj.nodes).forEach((entry) => {
    const key: string = entry[0];
    const node: model.Node = entry[1];
    g.nodes.push(nodeToSadface(node, key));
  });
  // Add edges
  Object.entries(obj.edges).forEach((entry) => {
    const key: string = entry[0];
    const edge: model.Edge = entry[1];
    g.edges.push(edgeToSadface(edge, key));
  });
  return g;
}

export function fromSadface(obj: Graph): model.Graph {
  var nodeDict: { [key: string]: model.Node } = {};
  obj.nodes.forEach((node) => (nodeDict[node.id] = nodeFromSadface(node)));
  var edgeDict: { [key: string]: model.Edge } = {};
  obj.edges.forEach((edge) => (edgeDict[edge.id] = edgeFromSadface(edge)));

  let metadata = {
    created:
      obj.metadata.core.created === undefined
        ? undefined
        : date.toProtobuf(obj.metadata.core.created),
    updated:
      obj.metadata.core.edited === undefined
        ? undefined
        : date.toProtobuf(obj.metadata.core.edited),
  };
  let analystId: string = uuid();
  let analysts: { [key: string]: model.Analyst } = {};
  analysts[analystId] = new model.Analyst({
    name: obj.metadata.core.analyst_name,
    email: obj.metadata.core.analyst_email,
  });

  const userdata = {
    notes: obj.metadata.core.notes === undefined ? "" : obj.metadata.core.notes,
    description:
      obj.metadata.core.description === undefined
        ? ""
        : obj.metadata.core.description,
    title: obj.metadata.core.title === undefined ? "" : obj.metadata.core.title,
    version:
      obj.metadata.core.version === undefined ? "" : obj.metadata.core.version,
  };

  return new model.Graph({
    nodes: nodeDict,
    edges: edgeDict,
    resources: {},
    participants: {},
    userdata: Struct.fromJson(userdata),
    analysts: analysts,
    schemaVersion: 1,
    libraryVersion: argServicesVersion,
    metadata: metadata,
  });
}