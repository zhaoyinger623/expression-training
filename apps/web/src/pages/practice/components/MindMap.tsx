import type { MindMapNode } from '@expression/shared';
import styles from './mindMap.module.less';

export function MindMap({ title, center, nodes, variant }: { title: string; center: string; nodes: MindMapNode[]; variant: 'user' | 'reference' }) {
  const leftNodes = nodes.map((node, index) => ({ node, index })).filter(({ index }) => index % 2 === 1);
  const rightNodes = nodes.map((node, index) => ({ node, index })).filter(({ index }) => index % 2 === 0);
  return <section className={`${styles['mindmap-view']} ${styles[`mindmap-${variant}`]}`} aria-label={title}>
    <h3>{title}</h3>
    <div className={styles['mindmap']}>
      <ul className={`${styles['mindmap-side']} ${styles['mindmap-side-left']}`}>{leftNodes.map(({ node, index }) => <MindMapBranch key={`${node.label}-${index}`} node={node} tone={index} side="left" depth={0} />)}</ul>
      <strong className={styles['mindmap-center']}>{center}</strong>
      <ul className={`${styles['mindmap-side']} ${styles['mindmap-side-right']}`}>{rightNodes.map(({ node, index }) => <MindMapBranch key={`${node.label}-${index}`} node={node} tone={index} side="right" depth={0} />)}</ul>
    </div>
  </section>;
}

function MindMapBranch({ node, tone, side, depth }: { node: MindMapNode; tone: number; side: 'left' | 'right'; depth: number }) {
  return <li className={`${styles['mindmap-branch']} ${styles[`branch-tone-${tone % 4}`]} ${depth === 0 ? styles['mindmap-root'] : styles['mindmap-child']}`}>
    <span>{node.label}</span>
    {node.children.length > 0 && <ul>{node.children.map((child, index) => <MindMapBranch key={`${child.label}-${index}`} node={child} tone={tone} side={side} depth={depth + 1} />)}</ul>}
  </li>;
}
