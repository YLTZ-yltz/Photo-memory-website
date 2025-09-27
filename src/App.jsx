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

  // 图片上传处理
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage = {
          id: Date.now(),
          url: event.target.result,
          name: file.name
        };
        const updatedImages = [...images, newImage];
        setImages(updatedImages);
        localStorage.setItem('galleryImages', JSON.stringify(updatedImages));
        // 图片上传后生成新的同步码
        if (isAdmin) {
          generateSyncCode();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 删除图片
  const handleDeleteImage = (imageId) => {
    const updatedImages = images.filter(image => image.id !== imageId);
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

  // 生成同步码
  const generateSyncCode = () => {
    try {
      // 创建包含所有必要数据的对象，包含完整图片数据
      const syncData = {
        images: images, // 包含完整图片数据
        settings: {
          playInterval: playInterval,
          transitionEffect: transitionEffect,
          backgroundStyle: backgroundStyle,
          lastSyncTime: Date.now()
        }
      };
      
      // 将数据转换为Base64编码的字符串
      const jsonData = JSON.stringify(syncData);
      const base64Data = btoa(unescape(encodeURIComponent(jsonData)));
      
      // 同步码就是完整的base64数据
      setSyncCode(base64Data);
      
      // 也可以存储一份到本地，方便后续使用
      localStorage.setItem('syncData', base64Data);
    } catch (error) {
      console.error('生成同步码时出错:', error);
      // 即使出错也继续执行，避免应用崩溃
    }
  };

  // 通过同步码同步数据
  const syncDataWithCode = (code) => {
    try {
      // 直接解码输入的同步码（现在同步码本身包含完整数据）
      const jsonData = decodeURIComponent(escape(atob(code)));
      const syncData = JSON.parse(jsonData);
      
      // 更新图片数据
      if (syncData.images && syncData.images.length > 0) {
        setImages(syncData.images);
        localStorage.setItem('galleryImages', JSON.stringify(syncData.images));
        console.log('成功同步了图片数据');
      }
      
      // 更新设置
      if (syncData.settings) {
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
          id: 1,
          url: sample1,
          name: '示例图片1'
        },
        {
          id: 2,
          url: sample2,
          name: '示例图片2'
        },
        {
          id: 3,
          url: sample3,
          name: '示例图片3'
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
                  key={image.id}
                  className={`slide ${index === currentImageIndex ? 'active' : ''}`}
                  style={{ transition: transitionEffect === 'fade' ? 'opacity 1s ease' : 'transform 1s ease' }}
                >
                  <img src={image.url} alt={`照片 ${index + 1}`} />
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