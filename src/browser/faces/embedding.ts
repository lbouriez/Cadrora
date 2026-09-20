export const EMBEDDING_DIMENSIONS = 128;

export function normalizeEmbedding(values: ArrayLike<number>): number[] {
  if (values.length !== EMBEDDING_DIMENSIONS) throw new Error('FACE_EMBEDDING_DIMENSIONS');
  const embedding = Array.from(values);
  if (embedding.some((value) => !Number.isFinite(value))) throw new Error('FACE_EMBEDDING_NOT_FINITE');
  const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude <= Number.EPSILON) throw new Error('FACE_EMBEDDING_EMPTY');
  return embedding.map((value) => value / magnitude);
}
