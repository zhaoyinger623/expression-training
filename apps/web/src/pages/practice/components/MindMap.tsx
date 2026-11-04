import { useEffect, useMemo, useRef } from 'react';
import type { MindMapNode } from '@expression/shared';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import styles from './mindMap.module.less';

const transformer = new Transformer();

export function MindMap({ title, center, nodes, variant }: { title: string; center: string; nodes: MindMapNode[]; variant: 'user' | 'reference' }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markdown = useMemo(() => {
    const lines = [`# ${center}`, ...nodes.flatMap((node) => renderNode(node, 1))];
    return lines.join('\n');
  }, [center, nodes]);

  useEffect(() => {
    if (!svgRef.current) return;
    const { root } = transformer.transform(markdown);
    const markmap = Markmap.create(svgRef.current, {
      autoFit: true,
      duration: 0,
      initialExpandLevel: -1,
      maxWidth: 260,
      spacingHorizontal: 90,
      spacingVertical: 14,
      paddingX: 14,
      style: () => variant === 'user'
        ? '.markmap-node circle { fill: #526579 } .markmap-link { stroke: #8293a3 }'
        : '.markmap-node circle { fill: #8067a7 } .markmap-link { stroke: #aa9abd }',
    }, root);
    return () => markmap.destroy();
  }, [markdown, variant]);

  return <section className={`${styles['mindmap-view']} ${styles[`mindmap-${variant}`]}`} aria-label={title}>
    <h3>{title}</h3>
    <svg ref={svgRef} className={styles['mindmap-canvas']} role="img" aria-label={`${title}：${center}`} />
  </section>;
}

function renderNode(node: MindMapNode, depth: number): string[] {
  const indent = '  '.repeat(depth);
  return [`${indent}- ${node.label}`, ...node.children.flatMap((child) => renderNode(child, depth + 1))];
}
