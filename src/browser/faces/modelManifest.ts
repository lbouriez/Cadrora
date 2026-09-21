export interface FaceModelAsset {
  byteSize: number;
  id: 'yunet' | 'sface';
  immutableUrl: string;
  license: 'MIT' | 'Apache-2.0';
  sha256: string;
  url: string;
  version: string;
  dimensions: number;
  metric: 'cosine';
  preprocessing: string;
  sizeBudgetBytes: number;
}

export const FACE_MODEL_MANIFEST = {
  version: 1,
  models: [
    {
      id: 'yunet',
      version: '2023mar',
      license: 'MIT',
      byteSize: 232_589,
      sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
      url: '/models/v1/face_detection_yunet_2023mar.onnx',
      immutableUrl: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
      dimensions: 15,
      metric: 'cosine',
      preprocessing: 'BGR NCHW float32 at the pinned 640x640 input; YuNet stride 8, 16, and 32 heads decoded as center offsets plus exponential width/height; score threshold 0.75; NMS IoU 0.3.',
      sizeBudgetBytes: 250_000,
    },
    {
      id: 'sface',
      version: '2021dec',
      license: 'Apache-2.0',
      byteSize: 38_696_353,
      sha256: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
      url: '/models/v1/face_recognition_sface_2021dec.onnx',
      immutableUrl: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx',
      dimensions: 128,
      metric: 'cosine',
      preprocessing: 'Five-landmark affine alignment to 112x112, RGB NCHW float32 with raw 0-255 pixels (OpenCV blobFromImage swapRB=true, scale=1); L2-normalized output.',
      sizeBudgetBytes: 39_000_000,
    },
  ] satisfies FaceModelAsset[],
} as const;
