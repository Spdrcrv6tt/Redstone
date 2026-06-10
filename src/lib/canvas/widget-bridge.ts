import type { CanvasDocument, CanvasWidgetBinding } from "@/types/canvas";

export const WIDGET_EMIT = "redstone-widget-emit";
export const WIDGET_RECEIVE = "redstone-widget-receive";

export interface WidgetEmitMessage {
  type: typeof WIDGET_EMIT;
  nodeId: string;
  channel: string;
  payload: unknown;
}

export interface WidgetReceiveMessage {
  type: typeof WIDGET_RECEIVE;
  channel: string;
  sourceId: string;
  targetId: string;
  sourceKey?: string;
  targetKey?: string;
  payload: unknown;
}

/** Injected into canvas widget iframes — exposes window.redstone.emit/on API. */
export function buildCanvasWidgetBridgeScript(nodeId: string): string {
  const id = JSON.stringify(nodeId);
  return `<script>
(function () {
  var nodeId = ${id};
  var listeners = {};
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "${WIDGET_RECEIVE}") return;
    var fns = listeners[e.data.channel] || [];
    for (var i = 0; i < fns.length; i++) fns[i](e.data.payload, e.data);
  });
  window.redstone = {
    nodeId: nodeId,
    emit: function (channel, payload) {
      parent.postMessage(
        { type: "${WIDGET_EMIT}", nodeId: nodeId, channel: channel, payload: payload },
        "*"
      );
    },
    on: function (channel, fn) {
      if (!listeners[channel]) listeners[channel] = [];
      listeners[channel].push(fn);
    },
  };
})();
</script>`;
}

export function routeWidgetEmit(
  doc: CanvasDocument,
  emit: WidgetEmitMessage,
  postToTarget: (targetId: string, message: WidgetReceiveMessage) => void
): void {
  const edges = [...doc.edges, ...doc.draftEdges];
  for (const edge of edges) {
    const bind = edge.data?.bind as CanvasWidgetBinding | undefined;
    if (!bind || edge.source !== emit.nodeId) continue;
    if (bind.channel !== emit.channel) continue;
    postToTarget(edge.target, {
      type: WIDGET_RECEIVE,
      channel: bind.channel,
      sourceId: emit.nodeId,
      targetId: edge.target,
      sourceKey: bind.sourceKey,
      targetKey: bind.targetKey,
      payload: emit.payload,
    });
  }
}
