import React, { Component, createRef, useState, useEffect, useCallback } from 'react';
import './App.css';

// 模拟管理员和访客账户数据
const ADMIN_ACCOUNT = {
  username: 'admin',
  password: 'admin123'
};

const GUEST_ACCOUNT = {
  username: 'guest',
  password: 'guest123'
};

// 图片工具函数
const compressImage = async (file, maxWidth = 1200, maxHeight = 800, quality = 0.8) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // 计算压缩后的尺寸，保持比例
      if (width > height) {
        if (width > maxWidth) {
          height = height * (maxWidth / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = width * (maxHeight / height);
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        resolve(blob);
      }, file.type, quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
};

const blobToDataURL = (blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

// 同步工具函数
const generateSyncData = (images, settings) => {
  const syncData = {
    i: images.map(img => ({ i: img.id, u: img.url, n: img.name, t: img.text || '' })),
    s: settings
  };
  
  return btoa(JSON.stringify(syncData));
};

const parseSyncData = (syncCode) => {
  try {
    const decoded = atob(syncCode);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('解析同步码失败:', error);
    return null;
  }
};

// 新的App组件
class App extends Component {
  constructor(props) {
    super(props);
    
    // Refs
    this.fileInputRef = createRef();
    this.musicInputRef = createRef();
    this.audioRef = createRef();
    this.broadcastChannelRef = createRef(null);
    this.slideshowIntervalRef = createRef(null);
    
    // 状态初始化
    this.state = {
      // 认证状态
      showLogin: true,
      currentUser: '',
      isAdmin: false,
      loginUsername: '',
      loginPassword: '',
      
      // 图片数据
      images: [],
      currentImageIndex: 0,
      selectedImages: [], // 用于图片预览
      
      // 上传队列
      uploadQueue: [],
      isUploading: false,
      
      // 轮播设置
      isPlaying: false,
      playInterval: 3000,
      transitionEffect: 'fade',
      backgroundStyle: 'default',
      
      // 管理员面板
      showAdminPanel: false,
      
      // 背景音乐
      backgroundMusic: '',
      musicPlaying: false,
      
      // 同步相关
      lastSyncTime: 0,
      lastUpdateTime: 0,
      
      // 自定义文字
      customText: '',
      textPosition: 'bottom',
      textColor: '#ffffff',
      textSize: 24,
      
      // 布局设置
      layout: 'fullscreen', // fullscreen, grid, slideshow
      gridColumns: 3,
    };
  }

  componentDidMount() {
    // 尝试从localStorage恢复用户状态
    const savedUser = localStorage.getItem('currentUser');
    const savedIsAdmin = localStorage.getItem('isAdmin');
    
    if (savedUser && savedIsAdmin !== null) {
      this.setState({
        showLogin: false,
        currentUser: savedUser,
        isAdmin: savedIsAdmin === 'true'
      }, this.loadImagesAndSettings);
    }
    
    // 初始化BroadcastChannel用于实时同步
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannelRef.current = new BroadcastChannel('photo-memory-sync');
      this.broadcastChannelRef.current.onmessage = this.handleSyncMessage;
    }
    
    // 如果是访客，设置自动同步检查
    if (savedUser === GUEST_ACCOUNT.username) {
      this.setupAutoSync();
    }
  }

  componentWillUnmount() {
    // 清理资源
    this.stopSlideshow();
    if (this.syncIntervalRef) {
      clearInterval(this.syncIntervalRef);
    }
    if (this.broadcastChannelRef.current) {
      this.broadcastChannelRef.current.close();
    }
  }

  // 加载图片和设置
  loadImagesAndSettings = () => {
    try {
      // 加载图片数据
      const imagesKey = this.state.isAdmin ? 'adminGalleryImages' : 'guestGalleryImages';
      const savedImages = localStorage.getItem(imagesKey);
      if (savedImages) {
        this.setState({ images: JSON.parse(savedImages) });
      }
      
      // 加载设置
      const playInterval = localStorage.getItem('playInterval');
      const transitionEffect = localStorage.getItem('transitionEffect');
      const backgroundStyle = localStorage.getItem('backgroundStyle');
      const customText = localStorage.getItem('customText');
      const textPosition = localStorage.getItem('textPosition');
      const textColor = localStorage.getItem('textColor');
      const textSize = localStorage.getItem('textSize');
      const layout = localStorage.getItem('layout');
      const gridColumns = localStorage.getItem('gridColumns');
      
      const settingsToUpdate = {};
      if (playInterval) settingsToUpdate.playInterval = parseInt(playInterval, 10);
      if (transitionEffect) settingsToUpdate.transitionEffect = transitionEffect;
      if (backgroundStyle) settingsToUpdate.backgroundStyle = backgroundStyle;
      if (customText) settingsToUpdate.customText = customText;
      if (textPosition) settingsToUpdate.textPosition = textPosition;
      if (textColor) settingsToUpdate.textColor = textColor;
      if (textSize) settingsToUpdate.textSize = parseInt(textSize, 10);
      if (layout) settingsToUpdate.layout = layout;
      if (gridColumns) settingsToUpdate.gridColumns = parseInt(gridColumns, 10);
      
      if (Object.keys(settingsToUpdate).length > 0) {
        this.setState(settingsToUpdate);
      }
      
      // 加载背景音乐
      const backgroundMusic = localStorage.getItem('backgroundMusic');
      if (backgroundMusic) {
        this.setState({ backgroundMusic });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 登录处理
  handleLogin = (e) => {
    e.preventDefault();
    
    const { loginUsername, loginPassword } = this.state;
    
    if (loginUsername === ADMIN_ACCOUNT.username && loginPassword === ADMIN_ACCOUNT.password) {
      this.setState({
        showLogin: false,
        currentUser: loginUsername,
        isAdmin: true
      }, () => {
        localStorage.setItem('currentUser', loginUsername);
        localStorage.setItem('isAdmin', 'true');
        this.loadImagesAndSettings();
      });
    } else if (loginUsername === GUEST_ACCOUNT.username && loginPassword === GUEST_ACCOUNT.password) {
      this.setState({
        showLogin: false,
        currentUser: loginUsername,
        isAdmin: false
      }, () => {
        localStorage.setItem('currentUser', loginUsername);
        localStorage.setItem('isAdmin', 'false');
        this.loadImagesAndSettings();
        this.setupAutoSync();
      });
    } else {
      alert('用户名或密码错误');
    }
  };

  // 切换账号功能
  handleSwitchAccount = () => {
    // 直接返回登录页面，但不清除localStorage中的用户信息
    this.setState({
      showLogin: true,
      loginUsername: '',
      loginPassword: ''
    });
  };

  // 登出处理
  handleLogout = () => {
    this.setState({
      showLogin: true,
      currentUser: '',
      isAdmin: false,
      loginUsername: '',
      loginPassword: ''
    });
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAdmin');
  };

  // 处理多张图片上传
  handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    this.setState({ 
      uploadQueue: [...this.state.uploadQueue, ...files],
      selectedImages: files
    }, this.processUploadQueue);
  };

  // 处理上传队列
  processUploadQueue = async () => {
    if (this.state.isUploading || this.state.uploadQueue.length === 0) return;
    
    this.setState({ isUploading: true });
    
    try {
      // 并发上传图片，限制并发数为3
      const concurrencyLimit = 3;
      const remainingQueue = [...this.state.uploadQueue];
      const newImages = [...this.state.images];
      
      while (remainingQueue.length > 0) {
        const batch = remainingQueue.splice(0, concurrencyLimit);
        const batchResults = await Promise.all(
          batch.map(async (file) => this.processSingleImage(file))
        );
        
        newImages.push(...batchResults);
        this.setState({ images: newImages });
      }
      
      // 保存到localStorage
      localStorage.setItem('adminGalleryImages', JSON.stringify(newImages));
      
      // 广播同步通知
      this.broadcastSyncNotification();
      
    } catch (error) {
      console.error('上传图片失败:', error);
    } finally {
      this.setState({ 
        isUploading: false,
        uploadQueue: [],
        selectedImages: []
      });
    }
  };

  // 处理单个图片
  processSingleImage = async (file) => {
    try {
      // 压缩图片以提升性能
      const compressedBlob = await compressImage(file);
      const dataURL = await blobToDataURL(compressedBlob);
      
      return {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        url: dataURL,
        name: file.name,
        text: '' // 初始化为空，后续可编辑
      };
    } catch (error) {
      console.error('处理图片失败:', error);
      throw error;
    }
  };

  // 删除图片
  handleDeleteImage = (imageId) => {
    const updatedImages = this.state.images.filter(image => image.id !== imageId);
    
    this.setState({ images: updatedImages }, () => {
      // 保存到localStorage
      localStorage.setItem('adminGalleryImages', JSON.stringify(updatedImages));
      
      // 广播同步通知
      this.broadcastSyncNotification();
    });
  };

  // 更新图片文字
  updateImageText = (imageId, text) => {
    const updatedImages = this.state.images.map(image => 
      image.id === imageId ? { ...image, text } : image
    );
    
    this.setState({ images: updatedImages }, () => {
      // 保存到localStorage
      localStorage.setItem('adminGalleryImages', JSON.stringify(updatedImages));
      
      // 广播同步通知
      this.broadcastSyncNotification();
    });
  };

  // 轮播控制
  startSlideshow = () => {
    this.stopSlideshow();
    
    this.slideshowIntervalRef.current = setInterval(() => {
      this.nextImage();
    }, this.state.playInterval);
  };

  stopSlideshow = () => {
    if (this.slideshowIntervalRef.current) {
      clearInterval(this.slideshowIntervalRef.current);
      this.slideshowIntervalRef.current = null;
    }
  };

  togglePlay = () => {
    const isPlaying = !this.state.isPlaying;
    this.setState({ isPlaying }, () => {
      if (isPlaying) {
        this.startSlideshow();
      } else {
        this.stopSlideshow();
      }
    });
  };

  nextImage = () => {
    if (this.state.images.length === 0) return;
    
    this.setState(prevState => ({
      currentImageIndex: (prevState.currentImageIndex + 1) % prevState.images.length
    }));
  };

  prevImage = () => {
    if (this.state.images.length === 0) return;
    
    this.setState(prevState => ({
      currentImageIndex: (prevState.currentImageIndex - 1 + prevState.images.length) % prevState.images.length
    }));
  };

  goToImage = (index) => {
    this.setState({ currentImageIndex: index });
  };

  // 背景音乐控制
  handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 检查文件大小，限制为5MB以避免性能问题
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      alert('音乐文件过大，请选择小于5MB的文件');
      return;
    }
    
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const musicDataUrl = event.target.result;
          this.setState({ backgroundMusic: musicDataUrl }, () => {
            // 使用sessionStorage代替localStorage存储大型音乐文件
            sessionStorage.setItem('backgroundMusic', musicDataUrl);
            if (this.state.isAdmin) {
              this.broadcastSyncNotification();
            }
          });
        } catch (error) {
          console.error('设置音乐时出错:', error);
          alert('设置音乐失败，请重试');
        }
      };
      reader.onerror = (error) => {
        console.error('读取音乐文件时出错:', error);
        alert('读取音乐文件失败，请重试');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('上传音乐时出错:', error);
      alert('上传音乐失败，请重试');
    }
  };

  toggleMusic = () => {
    const musicPlaying = !this.state.musicPlaying;
    this.setState({ musicPlaying }, () => {
      if (this.audioRef.current) {
        if (musicPlaying) {
          this.audioRef.current.play().catch(error => {
            console.error('播放音乐失败:', error);
            this.setState({ musicPlaying: false });
          });
        } else {
          this.audioRef.current.pause();
        }
      }
    });
  };

  // 设置处理
  handleIntervalChange = (e) => {
    const playInterval = parseInt(e.target.value, 10) * 1000;
    this.setState({ playInterval }, () => {
      localStorage.setItem('playInterval', playInterval);
      if (this.state.isPlaying) {
        this.startSlideshow();
      }
      this.broadcastSyncNotification();
    });
  };

  handleTransitionChange = (e) => {
    const transitionEffect = e.target.value;
    this.setState({ transitionEffect }, () => {
      localStorage.setItem('transitionEffect', transitionEffect);
      this.broadcastSyncNotification();
    });
  };

  handleBackgroundChange = (e) => {
    const backgroundStyle = e.target.value;
    this.setState({ backgroundStyle }, () => {
      localStorage.setItem('backgroundStyle', backgroundStyle);
      this.broadcastSyncNotification();
    });
  };

  // 自定义文字设置
  handleCustomTextChange = (e) => {
    const customText = e.target.value;
    this.setState({ customText }, () => {
      localStorage.setItem('customText', customText);
      this.broadcastSyncNotification();
    });
  };

  handleTextPositionChange = (e) => {
    const textPosition = e.target.value;
    this.setState({ textPosition }, () => {
      localStorage.setItem('textPosition', textPosition);
      this.broadcastSyncNotification();
    });
  };

  handleTextColorChange = (e) => {
    const textColor = e.target.value;
    this.setState({ textColor }, () => {
      localStorage.setItem('textColor', textColor);
      this.broadcastSyncNotification();
    });
  };

  handleTextSizeChange = (e) => {
    const textSize = parseInt(e.target.value, 10);
    this.setState({ textSize }, () => {
      localStorage.setItem('textSize', textSize);
      this.broadcastSyncNotification();
    });
  };

  // 布局设置
  handleLayoutChange = (e) => {
    const layout = e.target.value;
    this.setState({ layout }, () => {
      localStorage.setItem('layout', layout);
      this.broadcastSyncNotification();
    });
  };

  handleGridColumnsChange = (e) => {
    const gridColumns = parseInt(e.target.value, 10);
    this.setState({ gridColumns }, () => {
      localStorage.setItem('gridColumns', gridColumns);
      this.broadcastSyncNotification();
    });
  };

  // 同步功能
  broadcastSyncNotification = () => {
    try {
      // 更新管理员最后更新时间
      const now = Date.now();
      localStorage.setItem('adminLastUpdateTime', now.toString());
      
      // 保存管理员数据供访客同步
      const settingsData = {
        p: this.state.playInterval,
        t: this.state.transitionEffect,
        b: this.state.backgroundStyle,
        c: this.state.customText,
        tp: this.state.textPosition,
        tc: this.state.textColor,
        ts: this.state.textSize,
        l: this.state.layout,
        gc: this.state.gridColumns
      };
      localStorage.setItem('adminSettings', JSON.stringify(settingsData));
      localStorage.setItem('adminGalleryImages', JSON.stringify(this.state.images));
      
      // 通过BroadcastChannel广播同步通知
      if (this.broadcastChannelRef.current) {
        this.broadcastChannelRef.current.postMessage({ type: 'sync-notification', timestamp: now });
      }
      
    } catch (error) {
      console.error('广播同步通知失败:', error);
    }
  };

  handleSyncMessage = (event) => {
    if (event.data.type === 'sync-notification' && !this.state.isAdmin) {
      // 访客收到同步通知，执行同步
      this.performAutoSync();
    }
  };

  setupAutoSync = () => {
    // 每30秒自动检查一次更新
    this.syncIntervalRef = setInterval(() => {
      this.checkForUpdates();
    }, 30000);
  };

  checkForUpdates = () => {
    const adminLastUpdateTime = localStorage.getItem('adminLastUpdateTime');
    const localLastUpdateTime = this.state.lastUpdateTime;
    
    if (adminLastUpdateTime && parseInt(adminLastUpdateTime, 10) > localLastUpdateTime) {
      this.performAutoSync();
    }
  };

  performAutoSync = async () => {
    try {
      // 获取管理员数据
      const adminGalleryImages = localStorage.getItem('adminGalleryImages');
      const adminSettings = localStorage.getItem('adminSettings');
      const adminLastUpdateTime = localStorage.getItem('adminLastUpdateTime');
      const adminBackgroundMusic = localStorage.getItem('backgroundMusic');
      
      if (adminGalleryImages) {
        const parsedImages = JSON.parse(adminGalleryImages);
        this.setState({ images: parsedImages });
        localStorage.setItem('guestGalleryImages', adminGalleryImages);
      }
      
      if (adminSettings) {
        const parsedSettings = JSON.parse(adminSettings);
        const settingsToUpdate = {};
        
        if (parsedSettings.p !== undefined) {
          settingsToUpdate.playInterval = parsedSettings.p;
          localStorage.setItem('playInterval', parsedSettings.p);
        }
        if (parsedSettings.t !== undefined) {
          settingsToUpdate.transitionEffect = parsedSettings.t;
          localStorage.setItem('transitionEffect', parsedSettings.t);
        }
        if (parsedSettings.b !== undefined) {
          settingsToUpdate.backgroundStyle = parsedSettings.b;
          localStorage.setItem('backgroundStyle', parsedSettings.b);
        }
        if (parsedSettings.c !== undefined) {
          settingsToUpdate.customText = parsedSettings.c;
          localStorage.setItem('customText', parsedSettings.c);
        }
        if (parsedSettings.tp !== undefined) {
          settingsToUpdate.textPosition = parsedSettings.tp;
          localStorage.setItem('textPosition', parsedSettings.tp);
        }
        if (parsedSettings.tc !== undefined) {
          settingsToUpdate.textColor = parsedSettings.tc;
          localStorage.setItem('textColor', parsedSettings.tc);
        }
        if (parsedSettings.ts !== undefined) {
          settingsToUpdate.textSize = parsedSettings.ts;
          localStorage.setItem('textSize', parsedSettings.ts);
        }
        if (parsedSettings.l !== undefined) {
          settingsToUpdate.layout = parsedSettings.l;
          localStorage.setItem('layout', parsedSettings.l);
        }
        if (parsedSettings.gc !== undefined) {
          settingsToUpdate.gridColumns = parsedSettings.gc;
          localStorage.setItem('gridColumns', parsedSettings.gc);
        }
        
        if (Object.keys(settingsToUpdate).length > 0) {
          this.setState(settingsToUpdate);
        }
      }
      
      if (adminBackgroundMusic) {
        this.setState({ backgroundMusic: adminBackgroundMusic });
      }
      
      if (adminLastUpdateTime) {
        this.setState({ lastUpdateTime: parseInt(adminLastUpdateTime, 10) });
      }
      
      this.setState({ lastSyncTime: Date.now() });
      
    } catch (error) {
      console.error('自动同步失败:', error);
    }
  };

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

  // 渲染图片预览
  renderImagePreview = () => {
    if (this.state.selectedImages.length === 0) return null;
    
    return (
      <div className="image-preview-overlay">
        <div className="image-preview-container">
          <button className="btn-close-preview" onClick={() => this.setState({ selectedImages: [] })}>关闭</button>
          <h3>图片预览 ({this.state.selectedImages.length}张)</h3>
          <div className="preview-grid">
            {this.state.selectedImages.map((file, index) => (
              <div key={index} className="preview-item">
                <img 
                  src={URL.createObjectURL(file)} 
                  alt={`预览 ${index + 1}`}
                  onLoad={() => URL.revokeObjectURL(file)}
                />
                <p>{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 渲染画廊内容
  renderGalleryContent = () => {
    if (this.state.images.length === 0) {
      return (
        <div className="no-images">
          <p>暂无照片，请上传照片后查看</p>
        </div>
      );
    }

    switch (this.state.layout) {
      case 'grid':
        return this.renderGridLayout();
      case 'slideshow':
      case 'fullscreen':
      default:
        return this.renderSlideshowLayout();
    }
  };

  // 渲染网格布局
  renderGridLayout = () => (
    <div className="grid-container" style={{ gridTemplateColumns: `repeat(${this.state.gridColumns}, 1fr)` }}>
      {this.state.images.map((image, index) => (
        <div key={image.id} className="grid-item">
          <img src={image.url} alt={image.name || '照片'} onClick={() => this.goToImage(index)} />
          {image.text && <p className="image-text">{image.text}</p>}
        </div>
      ))}
    </div>
  );

  // 渲染轮播布局
  renderSlideshowLayout = () => {
    const { currentImageIndex, images, transitionEffect } = this.state;
    const currentImage = images[currentImageIndex];
    
    return (
      <div className="carousel-container">
        <div className="carousel">
          {images.map((image, index) => {
            const isActive = index === currentImageIndex;
            const transitionStyle = transitionEffect === 'fade'
              ? { opacity: isActive ? 1 : 0 }
              : transitionEffect === 'slide'
                ? { transform: isActive ? 'translateX(0)' : index < currentImageIndex ? 'translateX(-100%)' : 'translateX(100%)' }
                : { transform: isActive ? 'scale(1)' : 'scale(0.8)', opacity: isActive ? 1 : 0 };
            
            return (
              <div
                key={image.id}
                className={`slide ${isActive ? 'active' : ''}`}
                style={{ ...transitionStyle, transition: 'all 1s ease' }}
              >
                <img src={image.url} alt={image.name || '照片'} />
                {image.text && (
                  <div 
                    className={`image-overlay-text position-${this.state.textPosition}`}
                    style={{
                      color: this.state.textColor,
                      fontSize: `${this.state.textSize}px`
                    }}
                  >
                    {image.text}
                  </div>
                )}
                {this.state.customText && (
                  <div 
                    className={`global-overlay-text position-${this.state.textPosition}`}
                    style={{
                      color: this.state.textColor,
                      fontSize: `${this.state.textSize}px`
                    }}
                  >
                    {this.state.customText}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 导航控制 */}
        <button className="nav-btn prev" onClick={this.prevImage}>‹</button>
        <button className="nav-btn next" onClick={this.nextImage}>›</button>

        {/* 播放/暂停控制 */}
        <button className="play-btn" onClick={this.togglePlay}>
          {this.state.isPlaying ? '⏸️' : '▶️'}
        </button>

        {/* 指示器 */}
        <div className="indicators">
          {images.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
              onClick={() => this.goToImage(index)}
            />
          ))}
        </div>
      </div>
    );
  };

  // 主渲染方法
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
        {/* 管理员面板 */}
              {this.state.isAdmin && this.state.showAdminPanel && (
                <div key="admin-panel" className="admin-panel-wrapper">
                  <div className="admin-panel">
                    <div className="admin-panel-header">
                      <h3>管理员控制面板</h3>
                      <button 
                        className="btn-secondary btn-small"
                        onClick={() => this.setState({ showAdminPanel: false })}
                      >
                        返回
                      </button>
                    </div>
              
              {/* 自动同步区域 */}
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
              
              {/* 图片上传 */}
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
                {this.state.isUploading && (
                  <p className="upload-status">上传中... ({this.state.uploadQueue.length + 1}张图片)</p>
                )}
              </div>

              {/* 播放设置 */}
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
                <div className="setting-item">
                  <label>背景样式</label>
                  <select value={this.state.backgroundStyle} onChange={this.handleBackgroundChange}>
                    <option value="default">默认渐变</option>
                    <option value="dark">深色模式</option>
                    <option value="light">浅色模式</option>
                    <option value="colorful">多彩渐变</option>
                  </select>
                </div>
              </div>

              {/* 布局设置 */}
              <div className="admin-section">
                <h4>布局设置</h4>
                <div className="setting-item">
                  <label>显示布局</label>
                  <select value={this.state.layout} onChange={this.handleLayoutChange}>
                    <option value="fullscreen">全屏轮播</option>
                    <option value="slideshow">标准轮播</option>
                    <option value="grid">网格视图</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>网格列数</label>
                  <select value={this.state.gridColumns} onChange={this.handleGridColumnsChange}>
                    <option value="2">2列</option>
                    <option value="3">3列</option>
                    <option value="4">4列</option>
                    <option value="5">5列</option>
                  </select>
                </div>
              </div>

              {/* 自定义文字 */}
              <div className="admin-section">
                <h4>自定义文字</h4>
                <div className="setting-item">
                  <label>全局文字</label>
                  <input
                    type="text"
                    value={this.state.customText}
                    onChange={this.handleCustomTextChange}
                    placeholder="输入要显示的文字"
                  />
                </div>
                <div className="setting-item">
                  <label>文字位置</label>
                  <select value={this.state.textPosition} onChange={this.handleTextPositionChange}>
                    <option value="top">顶部</option>
                    <option value="bottom">底部</option>
                    <option value="left">左侧</option>
                    <option value="right">右侧</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>文字颜色</label>
                  <input
                    type="color"
                    value={this.state.textColor}
                    onChange={this.handleTextColorChange}
                  />
                </div>
                <div className="setting-item">
                  <label>文字大小</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={this.state.textSize}
                    onChange={this.handleTextSizeChange}
                  />
                  <span>{this.state.textSize}px</span>
                </div>
              </div>

              {/* 背景音乐 */}
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

              {/* 已上传图片 */}
              <div className="admin-section">
                <h4>已上传图片</h4>
                {this.state.images.length === 0 ? (
                  <p className="no-images">暂无上传的图片</p>
                ) : (
                  <div className="image-grid">
                    {this.state.images.map((image) => (
                      <div key={image.id} className="image-item">
                        <img src={image.url} alt={image.name || '照片'} />
                        <div className="image-controls">
                          <input
                            type="text"
                            value={image.text}
                            onChange={(e) => this.updateImageText(image.id, e.target.value)}
                            placeholder="添加文字"
                            className="image-text-input"
                          />
                          <button 
                            className="btn-delete"
                            onClick={() => this.handleDeleteImage(image.id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 主画廊容器 */}
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
                        onClick={this.handleSwitchAccount}
                      >
                        切换账号
                      </button>
                      <button 
                        className="btn-small btn-primary"
                        onClick={this.handleLogout}
                      >
                        退出登录
                      </button>
                    </React.Fragment>
                  )}
                  {this.state.isAdmin && (
                    <React.Fragment key="admin-controls">
                      <button 
                        className="btn-small btn-primary"
                        onClick={this.handleSwitchAccount}
                      >
                        切换账号
                      </button>
                      <button 
                        className="btn-small btn-primary"
                        onClick={() => this.setState({ showAdminPanel: !this.state.showAdminPanel })}
                      >
                        {this.state.showAdminPanel ? '隐藏' : '显示'}管理面板
                      </button>
                    </React.Fragment>
                  )}
                </div>
            </div>
            
            {/* 画廊内容 */}
            {this.renderGalleryContent()}
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
        
        {/* 图片预览 */}
        {this.renderImagePreview()}
      </div>
    );
  }
}

export default App;