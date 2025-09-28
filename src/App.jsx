import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import sample1 from './assets/sample1.svg';
import sample2 from './assets/sample2.svg';
import sample3 from './assets/sample3.svg';

// 模拟数据 - 管理员账户
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// 模拟数据 - 访客账户
const GUEST_CREDENTIALS = {
  username: 'guest',
  password: 'guest123'
};

function App() {
  // 状态管理
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playInterval, setPlayInterval] = useState(3000); // 默认3秒切换
  const [transitionEffect, setTransitionEffect] = useState('fade'); // 默认淡入淡出效果
  const [uploadImage, setUploadImage] = useState(null);
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState('default');
  const [showLogin, setShowLogin] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [syncCode, setSyncCode] = useState(''); // 同步码
  const [inputSyncCode, setInputSyncCode] = useState(''); // 输入同步码
  const [lastSyncTime, setLastSyncTime] = useState(0); // 最后同步时间

  // Refs
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const musicInputRef = useRef(null);

  // 登录处理
  const handleLogin = (e) => {
    e.preventDefault();
    
    if (loginUsername === ADMIN_CREDENTIALS.username && 
        loginPassword === ADMIN_CREDENTIALS.password) {
      setCurrentUser(loginUsername);
      setIsAdmin(true);
      setShowLogin(false);
      setShowAdminPanel(true);
      localStorage.setItem('user', JSON.stringify({ username: loginUsername, admin: true }));
    } else if (loginUsername === GUEST_CREDENTIALS.username && 
               loginPassword === GUEST_CREDENTIALS.password) {
      setCurrentUser(loginUsername);
      setIsAdmin(false);
      setShowLogin(false);
      localStorage.setItem('user', JSON.stringify({ username: loginUsername, admin: false }));
    } else {
      alert('用户名或密码错误');
    }
  };

  // 登出处理
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setShowLogin(true);
    setShowAdminPanel(false);
    if (audioRef.current) {
      audioRef.current.pause();
      setMusicPlaying(false);
    }
    localStorage.removeItem('user');
  };

  // 图片压缩处理函数
  const compressImage = (file, maxWidth = 1000, quality = 0.8) => {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (event) => {
        img.src = event.target.result;
        
        img.onload = () => {
          // 创建canvas用于压缩
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 计算压缩后的尺寸，保持宽高比
          let newWidth = img.width;
          let newHeight = img.height;
          
          if (newWidth > maxWidth) {
            const ratio = maxWidth / newWidth;
            newWidth = maxWidth;
            newHeight = Math.floor(newHeight * ratio);
          }
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          // 在canvas上绘制图片
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          
          // 转换为DataURL，质量参数控制压缩率
          canvas.toBlob((blob) => {
            const blobReader = new FileReader();
            blobReader.onload = (e) => {
              resolve(e.target.result);
            };
            blobReader.readAsDataURL(blob);
          }, 'image/jpeg', quality);
        };
      };
      
      reader.readAsDataURL(file);
    });
  };

  // 图片上传队列状态
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [activeUploads, setActiveUploads] = useState(0);
  const MAX_CONCURRENT_UPLOADS = 3; // 同时处理的最大图片数量

  // 图片上传处理
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 显示上传提示
    alert(`开始上传 ${files.length} 张照片，可能需要一些时间...`);

    // 将所有文件添加到上传队列
    const newQueueItems = files.map(file => ({
      file, 
      id: Date.now() + Math.random() // 生成唯一ID
    }));

    setUploadQueue(prevQueue => [...prevQueue, ...newQueueItems]);
    
    // 处理上传队列
    processUploadQueue();
    
    // 清空文件输入，以便再次选择相同文件
    e.target.value = '';
  };

  // 处理上传队列
  const processUploadQueue = async () => {
    // 如果已经在处理队列或队列为空，则退出
    if (isProcessingQueue || uploadQueue.length === 0) return;

    setIsProcessingQueue(true);
    
    try {
      while (uploadQueue.length > 0 && activeUploads < MAX_CONCURRENT_UPLOADS) {
        // 取出队列中的一个文件
        const queueItem = uploadQueue[0];
        setUploadQueue(prevQueue => prevQueue.slice(1));
        
        // 增加活跃上传计数
        setActiveUploads(prev => prev + 1);
        
        // 上传单个文件
        await processSingleImage(queueItem.file);
        
        // 减少活跃上传计数
        setActiveUploads(prev => prev - 1);
        
        // 小暂停，防止UI卡顿
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('处理上传队列时出错:', error);
    } finally {
      // 检查是否还有待处理的文件
      if (uploadQueue.length > 0) {
        // 继续处理队列
        setIsProcessingQueue(false);
        setTimeout(processUploadQueue, 200);
      } else {
        // 队列为空，完成处理
        setIsProcessingQueue(false);
        alert('所有照片上传完成！');
        
        // 如果是管理员，在所有图片上传完成后重新生成同步码
        if (isAdmin) {
          setTimeout(generateSyncCode, 500);
        }
      }
    }
  };

  // 处理单个图片文件
  const processSingleImage = async (file) => {
    try {
      // 内存使用检查
      if (typeof window.performance !== 'undefined' && window.performance.memory) {
        const memory = window.performance.memory;
        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        // 如果内存使用超过80%，暂停一下
        if (usedPercent > 80) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 压缩图片
      const compressedDataUrl = await compressImage(file);
      
      // 使用setTimeout确保状态更新不会阻塞UI
      await new Promise(resolve => setTimeout(resolve, 0));
      
      setImages(prevImages => {
        const newImage = {
          i: Date.now(), // 使用简写键名
          u: compressedDataUrl, // url的简写
          n: file.name // name的简写
        };
        const updatedImages = [...prevImages, newImage];
        localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
        return updatedImages;
      });
      
    } catch (error) {
      console.error('处理图片时出错:', error);
      // 如果压缩失败，使用原始图片
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImages(prevImages => {
            const newImage = {
              i: Date.now(),
              u: event.target.result,
              n: file.name
            };
            const updatedImages = [...prevImages, newImage];
            localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
            return updatedImages;
          });
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };

  // 删除图片
  const handleDeleteImage = (imageId) => {
    const updatedImages = images.filter(image => image.i !== imageId);
    setImages(updatedImages);
    localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
    if (images.length === 1) {
      setCurrentImageIndex(0);
    } else if (currentImageIndex >= updatedImages.length) {
      setCurrentImageIndex(0);
    }
    // 图片更新后生成新的同步码
    if (isAdmin) {
      generateSyncCode();
    }
  };

  // 生成同步码（分片版）
  const generateSyncCode = () => {
    try {
      // 过滤图片数组，移除null或undefined值
      const filteredImages = images.filter(img => img && img.i && img.u && img.n);
      
      // 对于大量图片，采用分片策略
      const MAX_IMAGES_PER_SLICE = 10; // 每片最大图片数量
      const totalSlices = Math.ceil(filteredImages.length / MAX_IMAGES_PER_SLICE);
      
      // 生成一个唯一的批次ID，用于标识同一组同步码
      const batchId = Date.now().toString(36).substr(2, 9);
      
      if (totalSlices === 1) {
        // 单分片情况
        const syncData = {
          i: filteredImages, // images的简写
          s: {
            // 仅保留非null和非undefined的设置值
            ...(playInterval !== null && playInterval !== undefined && { p: playInterval }), // playInterval的简写
            ...(transitionEffect !== null && transitionEffect !== undefined && { t: transitionEffect }), // transitionEffect的简写
            ...(backgroundStyle !== null && backgroundStyle !== undefined && { b: backgroundStyle }), // backgroundStyle的简写
            l: Date.now() // lastSyncTime的简写
          },
          b: batchId, // 批次ID
          c: 1, // 当前分片
          t: 1  // 总分片
        };
        
        const jsonData = JSON.stringify(syncData);
        let base64Data = btoa(unescape(encodeURIComponent(jsonData)));
        const safeBase64 = base64Data
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        
        setSyncCode(safeBase64);
        localStorage.setItem('syncData', safeBase64);
        console.log('生成单分片同步码，大小:', safeBase64.length, '字符');
        
        // 清除之前可能存在的分片数据
        localStorage.removeItem('syncSlices');
      } else {
        // 多分片情况
        const slices = [];
        
        for (let i = 0; i < totalSlices; i++) {
          const sliceImages = filteredImages.slice(i * MAX_IMAGES_PER_SLICE, (i + 1) * MAX_IMAGES_PER_SLICE);
          
          const syncData = {
            i: sliceImages, // 仅包含当前分片的图片
            s: i === 0 ? {
              // 只在第一个分片包含设置信息
              ...(playInterval !== null && playInterval !== undefined && { p: playInterval }),
              ...(transitionEffect !== null && transitionEffect !== undefined && { t: transitionEffect }),
              ...(backgroundStyle !== null && backgroundStyle !== undefined && { b: backgroundStyle }),
              l: Date.now()
            } : undefined,
            b: batchId, // 批次ID
            c: i + 1, // 当前分片（从1开始）
            t: totalSlices  // 总分片
          };
          
          const jsonData = JSON.stringify(syncData);
          let base64Data = btoa(unescape(encodeURIComponent(jsonData)));
          const safeBase64 = base64Data
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
          
          slices.push(safeBase64);
          console.log(`生成分片 ${i + 1}/${totalSlices}，大小:`, safeBase64.length, '字符');
        }
        
        // 保存所有分片到localStorage
        localStorage.setItem('syncSlices', JSON.stringify(slices));
        
        // 显示第一个分片
        setSyncCode(slices[0]);
        localStorage.setItem('syncData', slices[0]);
        
        // 提示用户这是一个多分片同步码
        alert(`共生成 ${totalSlices} 个同步码，请依次分享给访客进行完整同步。当前显示的是分片 1/${totalSlices}。`);
      }
    } catch (error) {
      console.error('生成同步码时出错:', error);
      alert('生成同步码失败，请稍后重试。');
    }
  };

  // 切换到下一个分片
  const nextSyncSlice = () => {
    try {
      const syncSlicesStr = localStorage.getItem('syncSlices');
      if (!syncSlicesStr) {
        alert('没有更多分片');
        return;
      }
      
      const syncSlices = JSON.parse(syncSlicesStr);
      const currentSyncCode = localStorage.getItem('syncData');
      const currentIndex = syncSlices.indexOf(currentSyncCode);
      
      if (currentIndex === -1 || currentIndex >= syncSlices.length - 1) {
        alert('已经是最后一个分片');
        return;
      }
      
      const nextSlice = syncSlices[currentIndex + 1];
      setSyncCode(nextSlice);
      localStorage.setItem('syncData', nextSlice);
      alert(`已切换到分片 ${currentIndex + 2}/${syncSlices.length}`);
    } catch (error) {
      console.error('切换分片时出错:', error);
    }
  };

  // 切换到上一个分片
  const prevSyncSlice = () => {
    try {
      const syncSlicesStr = localStorage.getItem('syncSlices');
      if (!syncSlicesStr) {
        alert('没有更多分片');
        return;
      }
      
      const syncSlices = JSON.parse(syncSlicesStr);
      const currentSyncCode = localStorage.getItem('syncData');
      const currentIndex = syncSlices.indexOf(currentSyncCode);
      
      if (currentIndex <= 0) {
        alert('已经是第一个分片');
        return;
      }
      
      const prevSlice = syncSlices[currentIndex - 1];
      setSyncCode(prevSlice);
      localStorage.setItem('syncData', prevSlice);
      alert(`已切换到分片 ${currentIndex}/${syncSlices.length}`);
    } catch (error) {
      console.error('切换分片时出错:', error);
    }
  };

  // 通过同步码同步数据（兼容分片和非分片同步码）
  const syncDataWithCode = (code) => {
    try {
      // 处理同步码：恢复URL安全字符为标准base64字符，并添加必要的填充
      let safeCode = code;
      
      // 将'-'恢复为'+'，'_'恢复为'/'
      safeCode = safeCode.replace(/-/g, '+').replace(/_/g, '/');
      
      // 添加必要的填充字符
      const padding = '='.repeat((4 - safeCode.length % 4) % 4);
      safeCode += padding;
      
      // 解码同步码获取数据
      const jsonData = decodeURIComponent(escape(atob(safeCode)));
      const syncData = JSON.parse(jsonData);
      
      // 检查是否为分片同步码
      const isSlice = syncData.b && syncData.c && syncData.t;
      
      if (isSlice) {
        // 分片同步逻辑
        const { b: batchId, c: currentSlice, t: totalSlices } = syncData;
        
        // 获取已同步的分片数据或创建新的
        const syncedSlicesKey = `synced_slices_${batchId}`;
        const existingSyncedSlicesStr = localStorage.getItem(syncedSlicesKey);
        const existingSyncedSlices = existingSyncedSlicesStr ? JSON.parse(existingSyncedSlicesStr) : {};
        
        // 存储当前分片的数据
        existingSyncedSlices[currentSlice] = {
          images: syncData.i || [],
          settings: syncData.s // 只在第一个分片有设置
        };
        
        localStorage.setItem(syncedSlicesKey, JSON.stringify(existingSyncedSlices));
        
        // 检查是否所有分片都已同步
        const isAllSlicesSynced = Object.keys(existingSyncedSlices).length === totalSlices;
        
        if (isAllSlicesSynced) {
          // 所有分片都已同步，合并数据
          let allImages = [];
          let settings = null;
          
          // 收集所有分片的图片和设置
          for (let i = 1; i <= totalSlices; i++) {
            const sliceData = existingSyncedSlices[i];
            if (sliceData) {
              // 验证图片数据有效性
              const validImages = (sliceData.images || []).filter(img => img && img.i && img.u);
              
              // 为图片数据添加缺失的键名
              const completeImages = validImages.map(img => ({
                i: img.i,
                u: img.u,
                n: img.n || `照片${img.i}`
              }));
              
              allImages = [...allImages, ...completeImages];
              
              // 设置只会在第一个分片包含
              if (i === 1 && sliceData.settings) {
                settings = sliceData.settings;
              }
            }
          }
          
          // 应用合并后的图片数据
          if (allImages.length > 0) {
            setImages(allImages);
            localStorage.setItem('galleryImages', JSON.stringify(allImages));
            console.log('成功合并并同步了所有分片的图片数据，共', allImages.length, '张');
          } else {
            console.warn('所有分片都同步完成，但没有找到有效图片');
          }
          
          // 应用设置
          if (settings) {
            if (settings.p) {
              setPlayInterval(settings.p);
              localStorage.setItem('playInterval', settings.p);
            }
            if (settings.t) {
              setTransitionEffect(settings.t);
              localStorage.setItem('transitionEffect', settings.t);
            }
            if (settings.b) {
              setBackgroundStyle(settings.b);
              localStorage.setItem('backgroundStyle', settings.b);
            }
          }
          
          // 清除临时分片数据
          localStorage.removeItem(syncedSlicesKey);
          
          // 提示用户同步完成
          alert(`已成功完成 ${totalSlices} 个分片的同步，共同步了 ${allImages.length} 张照片！`);
        } else {
          // 还有分片未同步
          const syncedCount = Object.keys(existingSyncedSlices).length;
          alert(`已成功同步分片 ${currentSlice}/${totalSlices}，还需同步 ${totalSlices - syncedCount} 个分片。\n请继续输入下一个同步码。`);
        }
      } else {
        // 非分片同步逻辑（兼容旧版）
        // 检查数据有效性
        let hasValidImages = false;
        
        // 更新图片数据（兼容新旧格式和最小化格式）
        if (syncData.i && syncData.i.length > 0) {
          // 处理新版格式（简写键名）和最小化格式
          const validImages = syncData.i.filter(img => img && img.i && img.u);
          
          if (validImages.length > 0) {
            // 为最小化图片数据添加缺失的键名，确保组件能正常渲染
            const completeImages = validImages.map(img => ({
              i: img.i,
              u: img.u,
              n: img.n || `照片${img.i}` // 如果没有name，使用默认名称
            }));
            
            setImages(completeImages);
            localStorage.setItem('galleryImages', JSON.stringify(completeImages));
            console.log('成功同步了图片数据，共', completeImages.length, '张');
            hasValidImages = true;
          }
        } else if (syncData.images && syncData.images.length > 0) {
          // 兼容旧版格式
          const validImages = syncData.images.filter(img => img && img.id && img.url);
          
          if (validImages.length > 0) {
            // 转换为新版格式（简写键名）
            const convertedImages = validImages.map(img => ({
              i: img.id,
              u: img.url,
              n: img.name || `照片${img.id}`
            }));
            
            setImages(convertedImages);
            localStorage.setItem('galleryImages', JSON.stringify(convertedImages));
            console.log('成功同步了图片数据（旧版格式），共', convertedImages.length, '张');
            hasValidImages = true;
          }
        }
        
        if (!hasValidImages) {
          console.warn('同步数据中不包含有效图片');
        }
        
        // 更新设置（兼容新旧格式）
        if (syncData.s) {
          // 处理新版格式（简写键名）
          if (syncData.s.p) {
            setPlayInterval(syncData.s.p);
            localStorage.setItem('playInterval', syncData.s.p);
          }
          if (syncData.s.t) {
            setTransitionEffect(syncData.s.t);
            localStorage.setItem('transitionEffect', syncData.s.t);
          }
          if (syncData.s.b) {
            setBackgroundStyle(syncData.s.b);
            localStorage.setItem('backgroundStyle', syncData.s.b);
          }
        } else if (syncData.settings) {
          // 兼容旧版格式
          if (syncData.settings.playInterval) {
            setPlayInterval(syncData.settings.playInterval);
            localStorage.setItem('playInterval', syncData.settings.playInterval);
          }
          if (syncData.settings.transitionEffect) {
            setTransitionEffect(syncData.settings.transitionEffect);
            localStorage.setItem('transitionEffect', syncData.settings.transitionEffect);
          }
          if (syncData.settings.backgroundStyle) {
            setBackgroundStyle(syncData.settings.backgroundStyle);
            localStorage.setItem('backgroundStyle', syncData.settings.backgroundStyle);
          }
        }
      }
      
      setLastSyncTime(Date.now());
      alert('同步成功！');
    } catch (error) {
      console.error('同步数据时出错:', error);
      alert('同步失败，请检查同步码是否正确。');
    }
  };

  // 同步处理函数
  const handleSync = (e) => {
    e.preventDefault();
    if (inputSyncCode) {
      syncDataWithCode(inputSyncCode);
      setInputSyncCode('');
    }
  };

  // 背景音乐上传处理
  const handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const musicUrl = event.target.result;
        setBackgroundMusic(musicUrl);
        localStorage.setItem('backgroundMusic', musicUrl);
        if (audioRef.current) {
          audioRef.current.src = musicUrl;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 控制音乐播放/暂停
  const toggleMusic = () => {
    if (!audioRef.current || !backgroundMusic) return;
    
    if (musicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error('播放音乐时出错:', error);
      });
    }
    setMusicPlaying(!musicPlaying);
  };

  // 控制图片轮播播放/暂停
  const togglePlay = () => {
    if (isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } else {
      startSlideshow();
    }
    setIsPlaying(!isPlaying);
  };

  // 下一张图片
  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  // 上一张图片
  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  // 开始轮播
  const startSlideshow = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(nextImage, playInterval);
  };

  // 切换到指定图片
  const goToImage = (index) => {
    setCurrentImageIndex(index);
    // 如果正在播放，重置计时器
    if (isPlaying) {
      startSlideshow();
    }
  };

  // 背景样式处理
  const handleBackgroundStyleChange = (style) => {
    setBackgroundStyle(style);
    localStorage.setItem('backgroundStyle', style);
  };

  // 播放间隔处理
  const handleIntervalChange = (e) => {
    const newInterval = parseInt(e.target.value, 10) * 1000; // 转换为毫秒
    setPlayInterval(newInterval);
    localStorage.setItem('playInterval', newInterval);
    // 如果正在播放，重置计时器
    if (isPlaying) {
      startSlideshow();
    }
  };

  // 过渡效果处理
  const handleTransitionChange = (e) => {
    setTransitionEffect(e.target.value);
    localStorage.setItem('transitionEffect', e.target.value);
  };

  // 初始化加载数据
  useEffect(() => {
    // 加载用户数据
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user.username);
      setIsAdmin(user.admin);
      setShowLogin(false);
      setShowAdminPanel(user.admin);
    }

    // 加载图片数据
    const savedImages = localStorage.getItem('galleryImages');
    if (savedImages) {
      setImages(JSON.parse(savedImages));
    } else {
      // 如果本地没有图片数据，加载示例图片
      const sampleImages = [
        {
          i: 1,
          u: sample1,
          n: '示例图片1'
        },
        {
          i: 2,
          u: sample2,
          n: '示例图片2'
        },
        {
          i: 3,
          u: sample3,
          n: '示例图片3'
        }
      ];
      setImages(sampleImages);
      localStorage.setItem('galleryImages', JSON.stringify(sampleImages));
    }

    // 加载配置数据
    const savedInterval = localStorage.getItem('playInterval');
    if (savedInterval) {
      setPlayInterval(parseInt(savedInterval, 10));
    }

    const savedEffect = localStorage.getItem('transitionEffect');
    if (savedEffect) {
      setTransitionEffect(savedEffect);
    }

    const savedStyle = localStorage.getItem('backgroundStyle');
    if (savedStyle) {
      setBackgroundStyle(savedStyle);
    }

    // 加载背景音乐
    const savedMusic = localStorage.getItem('backgroundMusic');
    if (savedMusic) {
      setBackgroundMusic(savedMusic);
    }
  }, []);

  // 初始化生成同步码（管理员）
  useEffect(() => {
    if (isAdmin && images.length > 0) {
      generateSyncCode();
    }
  }, [isAdmin, images.length]);

  // 开始轮播
  useEffect(() => {
    if (isPlaying && images.length > 0) {
      startSlideshow();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, images.length, playInterval]);

  // 渲染登录界面
  const renderLogin = () => (
    <div className="login-container">
      <div className="login-form">
        <h2>照片回忆 - 登录</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">登录</button>
          </div>
        </form>
        <div className="login-hint">
          <p>管理员账户: admin / admin123</p>
          <p>访客账户: guest / guest123</p>
        </div>
      </div>
    </div>
  );

  // 渲染管理员面板
  const renderAdminPanel = () => (
    <div className="admin-panel">
      <h3>管理员控制面板</h3>
      
      {/* 同步码区域 */}
      <div className="admin-section">
        <h4>照片同步</h4>
        <div className="sync-code-section">
          <div className="sync-code">
            {syncCode}
          </div>
          <div className="sync-instructions">
            <p>请将此同步码提供给访客，访客输入后即可同步照片和设置。</p>
            <p>图片更新后会自动生成新的同步码。</p>
          </div>
        </div>
      </div>
      
      <div className="admin-section">
        <h4>上传图片</h4>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          ref={fileInputRef}
        />
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
          选择图片
        </button>
      </div>

      <div className="admin-section">
        <h4>播放设置</h4>
        <div className="setting-item">
          <label>切换间隔 (秒)</label>
          <select value={playInterval / 1000} onChange={handleIntervalChange}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </div>
        <div className="setting-item">
          <label>过渡效果</label>
          <select value={transitionEffect} onChange={handleTransitionChange}>
            <option value="fade">淡入淡出</option>
            <option value="slide">滑动</option>
            <option value="zoom">缩放</option>
          </select>
        </div>
      </div>

      <div className="admin-section">
        <h4>背景音乐</h4>
        <input
          type="file"
          accept="audio/*"
          onChange={handleMusicUpload}
          style={{ display: 'none' }}
          ref={musicInputRef}
        />
        <button className="btn-secondary" onClick={() => musicInputRef.current?.click()}>
          上传音乐
        </button>
        {backgroundMusic && (
          <button 
            className={`btn-secondary ${musicPlaying ? 'btn-active' : ''}`}
            onClick={toggleMusic}
            style={{ marginLeft: '10px' }}
          >
            {musicPlaying ? '暂停音乐' : '播放音乐'}
          </button>
        )}
      </div>

      <div className="admin-section">
        <h4>已上传图片</h4>
        {images.length === 0 ? (
          <p className="no-images">暂无上传的图片</p>
        ) : (
          <div className="image-grid">
            {images.map((image, index) => (
              <div key={image.id} className="image-item">
                <img src={image.url} alt={image.name} />
                <button 
                  className="btn-delete"
                  onClick={() => handleDeleteImage(image.id)}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 渲染相册展示
  const renderGallery = () => (
    <div className={`gallery-container background-${backgroundStyle}`}>
      {/* 顶部控制栏 */}
      <div className="gallery-header">
        <h1>照片回忆</h1>
        <div className="user-controls">
          <span className="current-user">当前用户: {currentUser}</span>
          {backgroundMusic && (
            <button 
              className={`btn-small ${musicPlaying ? 'btn-active' : ''}`}
              onClick={toggleMusic}
            >
              {musicPlaying ? '暂停音乐' : '播放音乐'}
            </button>
          )}
          {!isAdmin && (
            <>
              {/* 访客同步码输入 */}
              <form onSubmit={handleSync} className="sync-form">
                <h3>同步照片</h3>
                <input
                  type="text"
                  value={inputSyncCode}
                  onChange={(e) => setInputSyncCode(e.target.value)}
                  placeholder="请输入从管理员获取的同步码"
                  className="sync-code-input"
                  style={{width: '100%', minHeight: '40px'}}
                />
                <button type="submit" className="btn-sync">
                  同步照片
                </button>
              </form>
              {lastSyncTime > 0 && (
                <span className="last-sync-time">
                  最后同步: {new Date(lastSyncTime).toLocaleString()}
                </span>
              )}
              <select 
                className="background-select"
                value={backgroundStyle}
                onChange={(e) => handleBackgroundStyleChange(e.target.value)}
              >
                <option value="default">默认背景</option>
                <option value="dark">深色主题</option>
                <option value="light">浅色主题</option>
                <option value="colorful">多彩主题</option>
              </select>
            </>
          )}
          <button className="btn-logout" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </div>

      {/* 图片展示区域 */}
      <div className="slideshow-container">
        {images.length === 0 ? (
          <div className="empty-state">
            <p>暂无照片</p>
            {isAdmin && <p>请上传照片来创建您的回忆画廊</p>}
          </div>
        ) : (
          <div className={`slideshow ${transitionEffect}`}>
            <div className="slideshow-inner">
              {images.map((image, index) => (
                <div
                  key={image.i}
                  className={`slide ${index === currentImageIndex ? 'active' : ''}`}
                  style={{ transition: transitionEffect === 'fade' ? 'opacity 1s ease' : 'transform 1s ease' }}
                >
                  <img src={image.u} alt={`照片 ${index + 1}`} />
                </div>
              ))}
            </div>

            {/* 导航控制 */}
            <button className="nav-btn prev" onClick={prevImage}>
              ‹
            </button>
            <button className="nav-btn next" onClick={nextImage}>
              ›
            </button>

            {/* 播放/暂停控制 */}
            <button className="play-btn" onClick={togglePlay}>
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* 指示器 */}
            <div className="indicators">
              {images.map((_, index) => (
                <button
                  key={index}
                  className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                  onClick={() => goToImage(index)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 隐藏的音频元素 */}
      {backgroundMusic && (
        <audio
          ref={audioRef}
          src={backgroundMusic}
          loop
          style={{ display: 'none' }}
        />
      )}
    </div>
  );

  return (
    <div className="app">
      {showLogin ? renderLogin() : (
        <>
          {isAdmin && showAdminPanel && renderAdminPanel()}
          {renderGallery()}
        </>
      )}
    </div>
  );
}

export default App;