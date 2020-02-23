import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import './css/index.css';

const video = document.getElementById('webcam');
const liveView = document.getElementById('liveView');
const demosSection = document.getElementById('demos');
const DEBUG = false;


// bodyPix 模型的设置参数
const bodyPixProperties = {
  architecture: 'MobileNetV1',
  outputStride: 16,
  multiplier: 0.75,
  quantBytes: 4
};

// 检测参数配置， 置信度设置为0.9， 避免误识别
const segmentationProperties = {
  flipHorizontal: false,
  internalResolution: 'high',
  segmentationThreshold: 0.9
};


// 搜索身体部位范围
const SEARCH_RADIUS = 300;
const SEARCH_OFFSET = SEARCH_RADIUS / 2;

// 搜索空间中的重叠。
const RESOLUTION_MIN = 20;

// 将返回的数据丢给canvas的上下文
function processSegmentation(canvas, segmentation) {
  var ctx = canvas.getContext('2d');
  
  // 从画布中获取数据
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  
  // 从相机获取数据
  var liveData = videoRenderCanvasCtx.getImageData(0, 0, canvas.width, canvas.height);
  var dataL = liveData.data;
  
 // 循环查看像素是否包含人体部位。 如果不是，请使用新数据更新背景。
  for (let x = RESOLUTION_MIN; x < canvas.width; x += RESOLUTION_MIN) {
    for (let y = RESOLUTION_MIN; y < canvas.height; y += RESOLUTION_MIN) {
      // Convert xy co-ords to array offset.
      let n = y * canvas.width + x;
      
      let foundBodyPartNearby = false;
      
      // 检查给定像素周围是否有其他像素像人体一样。
      let yMin = y - SEARCH_OFFSET;
      yMin = yMin < 0 ? 0: yMin;
      
      let yMax = y + SEARCH_OFFSET;
      yMax = yMax > canvas.height ? canvas.height : yMax;
      
      let xMin = x - SEARCH_OFFSET;
      xMin = xMin < 0 ? 0: xMin;
      
      let xMax = x + SEARCH_OFFSET;
      xMax = xMax > canvas.width ? canvas.width : xMax;
      
      for (let i = xMin; i < xMax; i++) {
        for (let j = yMin; j < yMax; j++) {
          
          let offset = j * canvas.width + i;
          // 如果我们正在分析的正方形中的任何像素有一个主体部分，标记为受污染。
          if (segmentation.data[offset] !== 0) {
            foundBodyPartNearby = true;
            break;
          } 
        }
      }
      
      // 更新未被污染的样本部分     
      if (!foundBodyPartNearby) {
        for (let i = xMin; i < xMax; i++) {
          for (let j = yMin; j < yMax; j++) {
            // 将xy坐标转换为数组偏移量。
            let offset = j * canvas.width + i;

            data[offset * 4] = dataL[offset * 4];    
            data[offset * 4 + 1] = dataL[offset * 4 + 1];
            data[offset * 4 + 2] = dataL[offset * 4 + 2];
            data[offset * 4 + 3] = 255;            
          }
        }
      } else {
        if (DEBUG) {
          for (let i = xMin; i < xMax; i++) {
            for (let j = yMin; j < yMax; j++) {
              // 将xy坐标转换为数组偏移量。
              let offset = j * canvas.width + i;

              data[offset * 4] = 255;    
              data[offset * 4 + 1] = 0;
              data[offset * 4 + 2] = 0;
              data[offset * 4 + 3] = 255;            
            }
          } 
        }
      }

    }
  }
  ctx.putImageData(imageData, 0, 0);
}



// 让我们使用上面定义的参数加载模型。在使用bodypix类之前，我们必须等待它完成加载。 
// 机器学习模型可能很大，需要一点时间才能获得运行所需的一切。
var modelHasLoaded = false;
var model = undefined;

model = bodyPix.load(bodyPixProperties).then(function (loadedModel) {
  model = loadedModel;
  modelHasLoaded = true;
  // Show demo section now model is ready to use.
  demosSection.classList.remove('invisible');
});


/**
 * 从网络摄像头流中连续获取图像并将其分类。
 */
var previousSegmentationComplete = true;

// 检测是否支持网络摄像头
function hasGetUserMedia() {
  return !!(navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia);
}


// 当浏览器准备处理网络摄像头的下一帧时，此功能将反复调用自身。
function predictWebcam() {
  if (previousSegmentationComplete) {
   //将视频帧从网络摄像头复制到内存中的临时画布（而不是DOM中）。
    videoRenderCanvasCtx.drawImage(video, 0, 0);
    previousSegmentationComplete = false;
    // 现在对可用的画布图像进行分类。
    model.segmentPerson(videoRenderCanvas, segmentationProperties).then(function(segmentation) {
      processSegmentation(webcamCanvas, segmentation);
      previousSegmentationComplete = true;
    });
  }

  // 再次调用此函数以预测浏览器准备就绪的时间。
  window.requestAnimationFrame(predictWebcam);
}


// 开启摄像头和开始分类
function enableCam(event) {
  if (!modelHasLoaded) {
    return;
  }
  
  // 隐藏按钮
  event.target.classList.add('removed');  

  const constraints = {
    video: true
  };

  // 激活网络摄像头流。
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    video.addEventListener('loadedmetadata', function() {
      // 视频成功播放后，请更新宽度和高度，否则最初的宽度和高度将为零，从而导致分类失败。
      webcamCanvas.width = video.videoWidth;
      webcamCanvas.height = video.videoHeight;
      videoRenderCanvas.width = video.videoWidth;
      videoRenderCanvas.height = video.videoHeight;
      let webcamCanvasCtx = webcamCanvas.getContext('2d');
      webcamCanvasCtx.drawImage(video, 0, 0);
    });
    
    video.srcObject = stream;
    
    video.addEventListener('loadeddata', predictWebcam);
  });
}


// 创建一个临时画布以进行渲染，以存储来自网络摄像头流的帧以进行分类。
var videoRenderCanvas = document.createElement('canvas');
var videoRenderCanvasCtx = videoRenderCanvas.getContext('2d');

// 让我们创建一个画布以将我们的发现呈现给DOM。
var webcamCanvas = document.createElement('canvas');
webcamCanvas.setAttribute('class', 'overlay');
liveView.appendChild(webcamCanvas);

// 如果支持网络摄像头，激活按钮时将事件侦听器添加到按钮。
if (hasGetUserMedia()) {
  const enableWebcamButton = document.getElementById('webcamButton');
  enableWebcamButton.addEventListener('click', enableCam);
} else {
  console.warn('getUserMedia() is not supported by your browser');
}
