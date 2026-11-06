import { Node, Extension, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { tokenizeMergeText, mergeFieldForToken } from "@/server/src/oyama-create/studio/merge-token";
import type { StudioNode } from "@/server/src/oyama-create/studio/types";

export const MergeField = Node.create({
  name: "mergeField", group: "inline", inline: true, atom: true, selectable: true,
  addAttributes: () => ({ field: { default: "" }, rawToken: { default: "" } }),
  parseHTML: () => [{ tag: "span[data-merge-field]", getAttrs: element => {
    const rawToken = element.textContent || "", field = mergeFieldForToken(rawToken);
    return field ? { field, rawToken } : false;
  } }],
  renderHTML: ({ node, HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-merge-field": node.attrs.field, class: "cs-merge-token", contenteditable: "false", title: `CRM field: ${node.attrs.field}` }), node.attrs.rawToken],
  renderText: ({ node }) => node.attrs.rawToken,
});

/** Convert complete recognized tokens after typing/paste without baking donor values into source. */
export const MergeTokenInput = Extension.create<{ enabled: () => boolean }>({
  name: "mergeTokenInput",
  addOptions: () => ({ enabled: () => true }),
  addProseMirrorPlugins() {
    return [new Plugin({ appendTransaction: (transactions, _old, state) => {
      if (!this.options.enabled() || !transactions.some(transaction => transaction.docChanged)) return null;
      const changes: Array<{ from: number; size: number; nodes: StudioNode[] }> = [];
      state.doc.descendants((node, from) => {
        if (!node.isText || !node.text) return;
        const nodes = tokenizeMergeText(node.text, node.marks.map(mark => mark.toJSON()));
        if (nodes.some(item => item.type === "mergeField")) changes.push({ from, size: node.nodeSize, nodes });
      });
      if (!changes.length) return null;
      const tr = state.tr;
      for (const change of changes.reverse()) tr.replaceWith(change.from, change.from + change.size, change.nodes.map(node => state.schema.nodeFromJSON(node)));
      return tr;
    } })];
  },
});
