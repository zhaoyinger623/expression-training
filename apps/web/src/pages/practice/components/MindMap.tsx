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
      color: () => variant === 'user' ? '#285f8f' : '#187568',
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
