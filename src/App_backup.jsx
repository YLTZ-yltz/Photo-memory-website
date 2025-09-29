import React, { Component, createRef } from 'react';
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

class App extends Component {
  constructor(props) {
    super(props);
    
    // 状态管理
    this.state = {
      currentUser: null,
      isAdmin: false,
      images: [],
      currentImageIndex: 0,
      isPlaying: true,
      playInterval: 3000, // 默认3秒切换
      transitionEffect: 'fade', // 默认淡入淡出效果
      uploadImage: null,
      backgroundMusic: null,
      musicPlaying: false,
      loginUsername: '',
      loginPassword: '',
      backgroundStyle: 'default',
      showLogin: true,
      showAdminPanel: false,
      adminPanelKey: 1, // 添加key状态，用于强制重新渲染
      syncCode: '', // 同步码（保留兼容旧版）
      inputSyncCode: '', // 输入同步码（保留兼容旧版）
      lastSyncTime: 0, // 最后同步时间
      lastUpdateTime: 0, // 最后更新时间（用于自动同步）
      uploadQueue: [],
      isProcessingQueue: false,
      activeUploads: 0
    };
    
    // Refs
    this.audioRef = createRef(null);
    this.intervalRef = createRef(null);
    this.fileInputRef = createRef(null);
    this.musicInputRef = createRef(null);
    this.broadcastChannelRef = createRef(null);
    this.autoSyncIntervalRef = createRef(null);
    
    // 常量
    this.MAX_CONCURRENT_UPLOADS = 3; // 同时处理的最大图片数量
  }

  // 登录处理
  handleLogin = (e) => {
    e.preventDefault();
    const { loginUsername, loginPassword } = this.state;
    
    if (loginUsername === ADMIN_CREDENTIALS.username && 
        loginPassword === ADMIN_CREDENTIALS.password) {
      this.setState({
        currentUser: loginUsername,
        isAdmin: true,
        showLogin: false,
        showAdminPanel: true
      });
      localStorage.setItem('user', JSON.stringify({ username: loginUsername, admin: true }));
    } else if (loginUsername === GUEST_CREDENTIALS.username && 
               loginPassword === GUEST_CREDENTIALS.password) {
      this.setState({
        currentUser: loginUsername,
        isAdmin: false,
        showLogin: false
      });
      localStorage.setItem('user', JSON.stringify({ username: loginUsername, admin: false }));
    } else {
      alert('用户名或密码错误');
    }
  };

  // 登出处理
  handleLogout = () => {
    this.setState({
      currentUser: null,
      isAdmin: false,
      showLogin: true,
      showAdminPanel: false,
      musicPlaying: false
    });
    if (this.audioRef.current) {
      this.audioRef.current.pause();
    }
    localStorage.removeItem('user');
  };

  // 图片压缩处理函数
  compressImage = (file, maxWidth = 1000, quality = 0.8) => {
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

  // 图片上传处理
  handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 显示上传提示
    alert(`开始上传 ${files.length} 张照片，可能需要一些时间...`);

    // 将所有文件添加到上传队列
    const newQueueItems = files.map(file => ({
      file, 
      id: Date.now() + Math.random() // 生成唯一ID
    }));

    this.setState(prevState => ({
      uploadQueue: [...prevState.uploadQueue, ...newQueueItems]
    }));
    
    // 处理上传队列
    this.processUploadQueue();
    
    // 清空文件输入，以便再次选择相同文件
    e.target.value = '';
  };

  // 处理上传队列
  processUploadQueue = async () => {
    const { uploadQueue, isProcessingQueue, activeUploads } = this.state;
    
    // 如果已经在处理队列或队列为空，则退出
    if (isProcessingQueue || uploadQueue.length === 0) return;

    this.setState({ isProcessingQueue: true });
    
    try {
      while (uploadQueue.length > 0 && activeUploads < this.MAX_CONCURRENT_UPLOADS) {
        // 取出队列中的一个文件
        const queueItem = uploadQueue[0];
        
        // 移除第一个文件并增加活跃上传计数
        this.setState(prevState => ({
          uploadQueue: prevState.uploadQueue.slice(1),
          activeUploads: prevState.activeUploads + 1
        }));
        
        // 上传单个文件
        await this.processSingleImage(queueItem.file);
        
        // 减少活跃上传计数
        this.setState(prevState => ({
          activeUploads: prevState.activeUploads - 1
        }));
        
        // 小暂停，防止UI卡顿
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('处理上传队列时出错:', error);
    } finally {
      // 检查是否还有待处理的文件
      if (this.state.uploadQueue.length > 0) {
        // 继续处理队列
        this.setState({ isProcessingQueue: false });
        setTimeout(() => this.processUploadQueue(), 200);
      } else {
        // 队列为空，完成处理
        this.setState({ isProcessingQueue: false });
        alert('所有照片上传完成！');
        
        // 如果是管理员，在所有图片上传完成后重新生成同步码
        if (this.state.isAdmin) {
          setTimeout(() => this.generateSyncCode(), 500);
        }
      }
    }
  };

  // 处理单个图片文件
  processSingleImage = async (file) => {
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
      const compressedDataUrl = await this.compressImage(file);
      
      // 使用setTimeout确保状态更新不会阻塞UI
      await new Promise(resolve => setTimeout(resolve, 0));
      
      this.setState(prevState => {
        const newImage = {
          i: Date.now(), // 使用简写键名
          u: compressedDataUrl, // url的简写
          n: file.name // name的简写
        };
        const updatedImages = [...prevState.images, newImage];
        localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
        return { images: updatedImages };
      });
      
      // 如果是管理员，广播同步通知
      if (this.state.isAdmin) {
        this.broadcastSyncNotification();
      }
      
    } catch (error) {
      console.error('处理图片时出错:', error);
      // 如果压缩失败，使用原始图片
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.setState(prevState => {
            const newImage = {
              i: Date.now(),
              u: event.target.result,
              n: file.name
            };
            const updatedImages = [...prevState.images, newImage];
            localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
            return { images: updatedImages };
          });
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };

  // 删除图片
  handleDeleteImage = (imageId) => {
    const { images, currentImageIndex, isAdmin } = this.state;
    const updatedImages = images.filter(image => image.i !== imageId);
    
    let newCurrentImageIndex = currentImageIndex;
    if (images.length === 1) {
      newCurrentImageIndex = 0;
    } else if (currentImageIndex >= updatedImages.length) {
      newCurrentImageIndex = 0;
    }
    
    this.setState({
      images: updatedImages,
      currentImageIndex: newCurrentImageIndex
    });
    
    localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
    
    // 图片更新后生成新的同步码并广播同步通知
    if (isAdmin) {
      this.generateSyncCode();
      this.broadcastSyncNotification();
    }
  };

  // 生成同步码（保留用于兼容旧版）
  generateSyncCode = () => {
    try {
      const { images, playInterval, transitionEffect, backgroundStyle } = this.state;
      
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
        
        this.setState({ syncCode: safeBase64 });
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
        this.setState({ syncCode: slices[0] });
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
  nextSyncSlice = () => {
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
      this.setState({ syncCode: nextSlice });
      localStorage.setItem('syncData', nextSlice);
      alert(`已切换到分片 ${currentIndex + 2}/${syncSlices.length}`);
    } catch (error) {
      console.error('切换分片时出错:', error);
    }
  };

  // 切换到上一个分片
  prevSyncSlice = () => {
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
      this.setState({ syncCode: prevSlice });
      localStorage.setItem('syncData', prevSlice);
      alert(`已切换到分片 ${currentIndex}/${syncSlices.length}`);
    } catch (error) {
      console.error('切换分片时出错:', error);
    }
  };

  // 通过同步码同步数据（兼容分片和非分片同步码）
  syncDataWithCode = (code) => {
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
            this.setState({ images: allImages });
            localStorage.setItem('galleryImages', JSON.stringify(allImages));
            console.log('成功合并并同步了所有分片的图片数据，共', allImages.length, '张');
          } else {
            console.warn('所有分片都同步完成，但没有找到有效图片');
          }
          
          // 应用设置
          if (settings) {
            if (settings.p) {
              this.setState({ playInterval: settings.p });
              localStorage.setItem('playInterval', settings.p);
            }
            if (settings.t) {
              this.setState({ transitionEffect: settings.t });
              localStorage.setItem('transitionEffect', settings.t);
            }
            if (settings.b) {
              this.setState({ backgroundStyle: settings.b });
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
              
              this.setState({ images: completeImages });
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
              
              this.setState({ images: convertedImages });
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
              this.setState({ playInterval: syncData.s.p });
              localStorage.setItem('playInterval', syncData.s.p);
            }
            if (syncData.s.t) {
              this.setState({ transitionEffect: syncData.s.t });
              localStorage.setItem('transitionEffect', syncData.s.t);
            }
            if (syncData.s.b) {
              this.setState({ backgroundStyle: syncData.s.b });
              localStorage.setItem('backgroundStyle', syncData.s.b);
            }
          } else if (syncData.settings) {
            // 兼容旧版格式
            if (syncData.settings.playInterval) {
              this.setState({ playInterval: syncData.settings.playInterval });
              localStorage.setItem('playInterval', syncData.settings.playInterval);
            }
            if (syncData.settings.transitionEffect) {
              this.setState({ transitionEffect: syncData.settings.transitionEffect });
              localStorage.setItem('transitionEffect', syncData.settings.transitionEffect);
            }
            if (syncData.settings.backgroundStyle) {
              this.setState({ backgroundStyle: syncData.settings.backgroundStyle });
              localStorage.setItem('backgroundStyle', syncData.settings.backgroundStyle);
            }
          }
        }
        
        this.setState({ lastSyncTime: Date.now() });
        alert('同步成功！');
      } catch (error) {
        console.error('同步数据时出错:', error);
        alert('同步失败，请检查同步码是否正确。');
      }
    };

    // 同步处理函数 - 手动同步
    handleSync = (e) => {
      if (e) e.preventDefault();
    if (this.state.inputSyncCode) {
      this.syncDataWithCode(this.state.inputSyncCode);
      this.setState({ inputSyncCode: '' });
    }
  };

  // 背景音乐上传处理
  handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const musicUrl = event.target.result;
        this.setState({ backgroundMusic: musicUrl });
        localStorage.setItem('backgroundMusic', musicUrl);
        if (this.audioRef.current) {
          this.audioRef.current.src = musicUrl;
        }
        // 如果是管理员，广播同步通知
        if (this.state.isAdmin) {
          this.broadcastSyncNotification();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 控制音乐播放/暂停
  toggleMusic = () => {
    if (!this.audioRef.current || !this.state.backgroundMusic) return;
    
    if (this.state.musicPlaying) {
      this.audioRef.current.pause();
    } else {
      this.audioRef.current.play().catch(error => {
        console.error('播放音乐时出错:', error);
      });
    }
    this.setState({ musicPlaying: !this.state.musicPlaying });
  };

  // 控制图片轮播播放/暂停
  togglePlay = () => {
    if (this.state.isPlaying) {
      if (this.intervalRef.current) {
        clearInterval(this.intervalRef.current);
      }
    } else {
      this.startSlideshow();
    }
    this.setState({ isPlaying: !this.state.isPlaying });
  };

  // 下一张图片
  nextImage = () => {
    if (this.state.images.length === 0) return;
    this.setState((prevState) => ({
      currentImageIndex: (prevState.currentImageIndex + 1) % prevState.images.length
    }));
  };

  // 上一张图片
  prevImage = () => {
    if (this.state.images.length === 0) return;
    this.setState((prevState) => ({
      currentImageIndex: prevState.currentImageIndex === 0 ? prevState.images.length - 1 : prevState.currentImageIndex - 1
    }));
  };

  // 开始轮播
  startSlideshow = () => {
    if (this.intervalRef.current) {
      clearInterval(this.intervalRef.current);
    }
    this.intervalRef.current = setInterval(() => this.nextImage(), this.state.playInterval);
  };

  // 切换到指定图片
  goToImage = (index) => {
    this.setState({ currentImageIndex: index });
    // 如果正在播放，重置计时器
    if (this.state.isPlaying) {
      this.startSlideshow();
    }
  };

  // 背景样式处理
  handleBackgroundStyleChange = (style) => {
    this.setState({ backgroundStyle: style });
    localStorage.setItem('backgroundStyle', style);
    // 如果是管理员，广播同步通知
    if (this.state.isAdmin) {
      this.broadcastSyncNotification();
    }
  };

  // 播放间隔处理
  handleIntervalChange = (e) => {
    const newInterval = parseInt(e.target.value, 10) * 1000; // 转换为毫秒
    this.setState({ playInterval: newInterval });
    localStorage.setItem('playInterval', newInterval);
    // 如果正在播放，重置计时器
    if (this.state.isPlaying) {
      this.startSlideshow();
    }
    // 如果是管理员，广播同步通知
    if (this.state.isAdmin) {
      this.broadcastSyncNotification();
    }
  };

  // 过渡效果处理
  handleTransitionChange = (e) => {
    this.setState({ transitionEffect: e.target.value });
    localStorage.setItem('transitionEffect', e.target.value);
    // 如果是管理员，广播同步通知
    if (this.state.isAdmin) {
      this.broadcastSyncNotification();
    }
  };

  // 初始化加载数据和自动同步机制
  componentDidMount() {
    // 加载用户数据
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.setState({
        currentUser: user.username,
        isAdmin: user.admin,
        showLogin: false,
        showAdminPanel: user.admin
      });
    }

    // 加载图片数据
    const savedImages = localStorage.getItem('galleryImages');
    if (savedImages) {
      this.setState({ images: JSON.parse(savedImages) });
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
      this.setState({ images: sampleImages });
      localStorage.setItem('galleryImages', JSON.stringify(sampleImages));
    }

    // 加载配置数据
    const savedInterval = localStorage.getItem('playInterval');
    if (savedInterval) {
      this.setState({ playInterval: parseInt(savedInterval, 10) });
    }

    const savedEffect = localStorage.getItem('transitionEffect');
    if (savedEffect) {
      this.setState({ transitionEffect: savedEffect });
    }

    const savedStyle = localStorage.getItem('backgroundStyle');
    if (savedStyle) {
      this.setState({ backgroundStyle: savedStyle });
    }

    // 加载背景音乐
    const savedMusic = localStorage.getItem('backgroundMusic');
    if (savedMusic) {
      this.setState({ backgroundMusic: savedMusic });
    }

    // 加载最后更新时间
    const savedLastUpdateTime = localStorage.getItem('lastUpdateTime');
    if (savedLastUpdateTime) {
      this.setState({ lastUpdateTime: parseInt(savedLastUpdateTime, 10) });
    }

    // 初始化BroadcastChannel用于自动同步
    try {
      this.broadcastChannelRef.current = new BroadcastChannel('photo-memory-sync');
      
      // 监听同步消息
      this.broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.type === 'sync-notification' && !this.state.isAdmin) {
          // 访客收到同步通知，执行自动同步
          this.performAutoSync();
        }
      };
      
      // 初始化时检查是否需要同步
      if (!this.state.isAdmin) {
        this.checkForUpdates();
      }
    } catch (error) {
      console.warn('BroadcastChannel API 不支持，将使用轮询方式进行同步:', error);
      
      // 如果不支持BroadcastChannel，使用轮询方式
      if (!this.state.isAdmin) {
        this.autoSyncIntervalRef.current = setInterval(() => this.checkForUpdates(), 30000); // 每30秒检查一次
      }
    }
  };

  // 清理资源
  componentWillUnmount() {
    // 清理资源
    if (this.broadcastChannelRef.current) {
      this.broadcastChannelRef.current.close();
    }
    if (this.autoSyncIntervalRef.current) {
      clearInterval(this.autoSyncIntervalRef.current);
    }
    if (this.intervalRef.current) {
      clearInterval(this.intervalRef.current);
    }
  }

  // 自动同步相关函数
  checkForUpdates = () => {
    const adminLastUpdateTime = localStorage.getItem('adminLastUpdateTime');
    const localLastUpdateTime = localStorage.getItem('lastUpdateTime') || '0';
    
    if (adminLastUpdateTime && parseInt(adminLastUpdateTime, 10) > parseInt(localLastUpdateTime, 10)) {
      this.performAutoSync();
    }
  };

  performAutoSync = async () => {
    try {
      // 直接从localStorage读取管理员的数据
      const adminImages = localStorage.getItem('adminGalleryImages');
      const adminSettings = localStorage.getItem('adminSettings');
      const adminLastUpdateTime = localStorage.getItem('adminLastUpdateTime');
      
      if (adminImages) {
        const parsedImages = JSON.parse(adminImages);
        this.setState({ images: parsedImages });
        localStorage.setItem('galleryImages', adminImages);
        console.log('自动同步成功，共同步了', parsedImages.length, '张照片');
      }
      
      if (adminSettings) {
        const parsedSettings = JSON.parse(adminSettings);
        // 应用设置
        const settingsToUpdate = {};
        if (parsedSettings.p) {
          settingsToUpdate.playInterval = parsedSettings.p;
          localStorage.setItem('playInterval', parsedSettings.p);
        }
        if (parsedSettings.t) {
          settingsToUpdate.transitionEffect = parsedSettings.t;
          localStorage.setItem('transitionEffect', parsedSettings.t);
        }
        if (parsedSettings.b) {
          settingsToUpdate.backgroundStyle = parsedSettings.b;
          localStorage.setItem('backgroundStyle', parsedSettings.b);
        }
        
        // 批量更新设置
        if (Object.keys(settingsToUpdate).length > 0) {
          this.setState(settingsToUpdate);
        }
      }
      
      if (adminLastUpdateTime) {
        this.setState({ lastUpdateTime: parseInt(adminLastUpdateTime, 10) });
        localStorage.setItem('lastUpdateTime', adminLastUpdateTime);
      }
      
      this.setState({ lastSyncTime: Date.now() });
      
    } catch (error) {
      console.error('自动同步失败:', error);
    }
  };

  // 管理员数据变更时广播同步通知
  broadcastSyncNotification = () => {
    try {
      // 更新管理员最后更新时间
      const now = Date.now();
      localStorage.setItem('adminLastUpdateTime', now.toString());
      
      // 保存管理员数据供访客同步
      const settingsData = {
        p: this.state.playInterval,
        t: this.state.transitionEffect,
        b: this.state.backgroundStyle
      };
      localStorage.setItem('adminSettings', JSON.stringify(settingsData));
      localStorage.setItem('adminGalleryImages', JSON.stringify(this.state.images));
      
      // 通过BroadcastChannel广播同步通知
      if (this.broadcastChannelRef.current) {
        this.broadcastChannelRef.current.postMessage({ type: 'sync-notification', timestamp: now });
      }
      
      console.log('同步通知已广播，数据已更新');
    } catch (error) {
      console.error('广播同步通知失败:', error);
    }
  };

  // 当管理员状态或图片数量变化时生成同步码
  componentDidUpdate(prevProps, prevState) {
    // 初始化生成同步码（管理员）- 保留用于兼容旧版
    if (this.state.isAdmin && this.state.images.length > 0 && 
        (prevState.isAdmin !== this.state.isAdmin || prevState.images.length !== this.state.images.length)) {
      this.generateSyncCode();
    }

    // 轮播控制
    if (this.state.isPlaying && this.state.images.length > 0) {
      if (!prevState.isPlaying || prevState.images.length !== this.state.images.length || prevState.playInterval !== this.state.playInterval) {
        this.startSlideshow();
      }
    }
  }

  // 渲染登录界面
  renderLogin = () => (
    <div className="login-container">
      <div className="login-form">
        <h2>照片回忆 - 登录</h2>
        <form onSubmit={this.handleLogin}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={this.state.loginUsername}
              onChange={(e) => this.setState({ loginUsername: e.target.value })}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={this.state.loginPassword}
              onChange={(e) => this.setState({ loginPassword: e.target.value })}
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

  // 重写renderAdminPanel方法，使用简化的JSX结构
  // 重写整个渲染方法，确保所有元素都有正确的key
  render() {
    if (this.state.showLogin) {
      return (
        <div className="app">
          {this.renderLogin()}
        </div>
      );
    }
    
    return (
      <div className="app">
        {this.state.isAdmin && this.state.showAdminPanel && (
          <div key="admin-panel" className="admin-panel-wrapper">
            <div className="admin-panel">
              <h3>管理员控制面板</h3>
              
              {/* 同步区域 - 自动同步 */}
              <div className="admin-section">
                <h4>自动同步</h4>
                <div className="sync-auto-section">
                  <div className="sync-status">
                    <p>自动同步已启用！</p>
                    <p>您的任何更改都会实时同步到所有访客设备。</p>
                  </div>
                  <button className="btn-secondary" onClick={this.broadcastSyncNotification}>
                    立即同步所有设备
                  </button>
                  <div className="sync-tip">
                    <p>同步机制：使用BroadcastChannel实时通知 + localStorage数据共享</p>
                    {this.state.lastSyncTime > 0 && (
                      <p>上次同步时间: {new Date(this.state.lastSyncTime).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="admin-section">
                <h4>上传图片</h4>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={this.handleImageUpload}
                  style={{ display: 'none' }}
                  ref={this.fileInputRef}
                />
                <button className="btn-secondary" onClick={() => this.fileInputRef.current?.click()}>
                  选择图片
                </button>
              </div>

              <div className="admin-section">
                <h4>播放设置</h4>
                <div className="setting-item">
                  <label>切换间隔 (秒)</label>
                  <select value={this.state.playInterval / 1000} onChange={this.handleIntervalChange}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>过渡效果</label>
                  <select value={this.state.transitionEffect} onChange={this.handleTransitionChange}>
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
                  onChange={this.handleMusicUpload}
                  style={{ display: 'none' }}
                  ref={this.musicInputRef}
                />
                <button className="btn-secondary" onClick={() => this.musicInputRef.current?.click()}>
                  上传音乐
                </button>
                {this.state.backgroundMusic && (
                  <button 
                    className={`btn-secondary ${this.state.musicPlaying ? 'btn-active' : ''}`}
                    onClick={this.toggleMusic}
                    style={{ marginLeft: '10px' }}
                  >
                    {this.state.musicPlaying ? '暂停音乐' : '播放音乐'}
                  </button>
                )}
              </div>

              <div className="admin-section">
                <h4>已上传图片</h4>
                {this.state.images.length === 0 ? (
                  <p className="no-images">暂无上传的图片</p>
                ) : (
                  <div className="image-grid">
                    {this.state.images.map((image) => (
                      <div key={image.i} className="image-item">
                        <img src={image.u} alt={image.n || '照片'} />
                        <button 
                          className="btn-delete"
                          onClick={() => this.handleDeleteImage(image.i)}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="gallery-wrapper">
          <div className={`gallery-container background-${this.state.backgroundStyle}`}>
            {/* 顶部控制栏 */}
            <div className="gallery-header">
              <h1>照片回忆</h1>
              <div className="user-controls">
                <span className="current-user">当前用户: {this.state.currentUser}</span>
                {this.state.backgroundMusic && (
                  <button 
                    className={`btn-small ${this.state.musicPlaying ? 'btn-active' : ''}`}
                    onClick={this.toggleMusic}
                  >
                    {this.state.musicPlaying ? '暂停音乐' : '播放音乐'}
                  </button>
                )}
                {!this.state.isAdmin && (
                  <React.Fragment key="guest-controls">
                    {/* 访客自动同步状态 */}
                    <div className="sync-auto-status">
                      <h3>自动同步状态</h3>
                      <p className="sync-message">系统已启用自动同步，照片和设置将自动更新</p>
                      {this.state.lastSyncTime > 0 && (
                        <p className="last-sync-time">
                          上次同步时间: {new Date(this.state.lastSyncTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button 
                      className="btn-small btn-primary"
                      onClick={() => this.setState({ showLogin: true })}
                    >
                      返回登录
                    </button>
                  </React.Fragment>
                )}
                {this.state.isAdmin && (
                  <button 
                    className="btn-small btn-primary"
                    onClick={() => this.setState({ showAdminPanel: !this.state.showAdminPanel })}
                  >
                    {this.state.showAdminPanel ? '隐藏' : '显示'}管理面板
                  </button>
                )}
              </div>
            </div>
            
            {/* 图片轮播区域 */}
            {this.state.images.length > 0 ? (
              <div className="carousel-container">
                <div className="carousel">
                  {this.state.images.map((image, index) => (
                    <div
                      key={image.i}
                      className={`slide ${index === this.state.currentImageIndex ? 'active' : ''}`}
                      style={{ transition: this.state.transitionEffect === 'fade' ? 'opacity 1s ease' : 'transform 1s ease' }}
                    >
                      <img src={image.u} alt={`照片 ${index + 1}`} />
                    </div>
                  ))}
                </div>

                {/* 导航控制 */}
                <button className="nav-btn prev" onClick={this.prevImage}>
                  ‹
                </button>
                <button className="nav-btn next" onClick={this.nextImage}>
                  ›
                </button>

                {/* 播放/暂停控制 */}
                <button className="play-btn" onClick={this.togglePlay}>
                  {this.state.isPlaying ? '⏸️' : '▶️'}
                </button>

                {/* 指示器 */}
                <div className="indicators">
                  {this.state.images.map((_, index) => (
                    <button
                      key={index}
                      className={`indicator ${index === this.state.currentImageIndex ? 'active' : ''}`}
                      onClick={() => this.goToImage(index)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-images">
                <p>暂无照片，请上传照片后查看</p>
              </div>
            )}
          </div>

          {/* 隐藏的音频元素 */}
          {this.state.backgroundMusic && (
            <audio
              ref={this.audioRef}
              src={this.state.backgroundMusic}
              loop
              style={{ display: 'none' }}
            />
          )}
        </div>
      </div>
    );
  }
}

export default App;