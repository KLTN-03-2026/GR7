import { LoginForm } from '@/components/login/login-form';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo2.png';
import ShinyText from '@/components/animations/ShinyText';
import { useTheme } from 'next-themes';
import MagicBento from '@/components/animations/MagicBento';

// Background image URL
const backgroundImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80';

export default function LoginPage() {
    const { theme } = useTheme();

    return (
        <div className="min-h-screen text-foreground transition-colors duration-300 overflow-hidden relative">
            {/* Background Image with Overlay */}
            <div 
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            >
                {/* Dark overlay layer */}
                <div 
                    className="absolute inset-0"
                    style={{
                        backgroundColor: theme === 'dark' 
                            ? 'rgba(0, 0, 0, 0.6)' 
                            : 'rgba(0, 0, 0, 0.3)',
                    }}
                />
                
                {/* Blur overlay layer */}
                <div 
                    className="absolute inset-0"
                    style={{
                        backdropFilter: 'blur(8px)',
                        backgroundColor: theme === 'dark' 
                            ? 'rgba(0, 0, 0, 0.3)' 
                            : 'rgba(255, 255, 255, 0.7)',
                    }}
                />
            </div>

            {/* Content */}
            <div className="grid lg:grid-cols-[60%_40%] min-h-screen relative z-10">
                {/* Left Side - Login Form (60%) */}
                <div className="flex flex-col justify-between p-6 md:p-10 lg:p-10 xl:p-12">
                    {/* Logo */}
                    <div className="flex justify-start">
                        <Link
                            to="/"
                            className="flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
                        >
                            <img
                                src={logo}
                                alt="Logo"
                                className="w-10 h-10 drop-shadow-md"
                            />
                            <span className="font-bold text-2xl">
                                <ShinyText
                                    text="EatEase"
                                    disabled={false}
                                    speed={3}
                                    color={
                                        theme === 'dark' ? '#e5e5e5' : '#1a1a1a'
                                    }
                                    shineColor="#C96048"
                                    spread={90}
                                />
                            </span>
                        </Link>
                    </div>
                    {/* Form Container - Centered */}
                    <div className="flex-1 flex items-center justify-center py-8">
                        <div className="w-full max-w-md">
                            {/* Welcome Text */}
                            <div className="mb-8 md:mb-10">
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 leading-relaxed">
                                <ShinyText
                                    text="Chào mừng trở lại"
                                    disabled={false}
                                    speed={3}
                                    color={
                                        theme === 'dark'
                                            ? '#e5e5e5'
                                            : '#1a1a1a'
                                    }
                                    shineColor="#C96048"
                                    spread={90}
                                />
                            </h1>
                                <p className="text-muted-foreground text-base md:text-lg">
                                    Đăng nhập để tiếp tục hành trình ẩm thực của
                                    bạn
                                </p>
                            </div>

                            {/* Login Form */}
                            <LoginForm />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-sm text-muted-foreground">
                        © 2026 EatEase. Trải nghiệm ẩm thực đẳng cấp.
                    </div>
                </div>

                {/* Right Side - Bento Grid (40% - Desktop Only) */}
                <div className="hidden lg:flex items-center justify-center py-8 px-8     from-orange-50/50 via-rose-50/30 to-amber-50/50 dark:from-background dark:via-background dark:to-background">
                    <div className="w-full">
                        <style>{`
                            .login-bento-grid {
                                display: grid;
                                grid-template-columns: repeat(2, 1fr);
                                grid-auto-rows: minmax(120px, auto);
                                gap: 1rem;
                            }
                            
                            /* Card 1 - Banner */
                            .login-bento-grid > div:nth-child(1) {
                                grid-row: span 2;
                                min-height: 280px;
                            }
                            .login-bento-grid > div:nth-child(1) .bento-card__bg-image {
                                opacity: 0.85 !important;
                                background-size: cover !important;
                                background-position: center !important;
                            }
                            .login-bento-grid > div:nth-child(1):hover .bento-card__bg-image {
                                opacity: 1 !important;
                            }
                            
                            /* Card 2 */
                            .login-bento-grid > div:nth-child(2) {
                                grid-row: span 1;
                                min-height: 130px;
                            }
                            
                            /* Card 3 - Full width */
                            .login-bento-grid > div:nth-child(3) {
                                grid-column: span 2;
                                grid-row: span 1;
                                min-height: 180px;
                            }
                            
                            /* Card 4 */
                            .login-bento-grid > div:nth-child(4) {
                                grid-row: span 1;
                                min-height: 150px;
                            }
                            
                            /* Card 5 */
                            .login-bento-grid > div:nth-child(5) {
                                grid-row: span 1;
                                min-height: 150px;
                            }
                            
                            /* Make all images brighter */
                            .login-bento-grid .bento-card__bg-image {
                                opacity: 0.65 !important;
                            }
                            .login-bento-grid .bento-card:hover .bento-card__bg-image {
                                opacity: 0.85 !important;
                            }
                        `}</style>
                        <MagicBento
                            cards={[
                                {
                                    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
                                    span: 'col-span-1 row-span-2',
                                },
                                {
                                    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
                                    span: 'col-span-1 row-span-1',
                                },
                                {
                                    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
                                    span: 'col-span-2 row-span-1',
                                },
                                {
                                    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
                                    span: 'col-span-1 row-span-1',
                                },
                                {
                                    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
                                    span: 'col-span-1 row-span-1',
                                },
                            ]}
                            gridClassName="grid-cols-2"
                            glowColor="255, 140, 50"
                            enableBorderGlow={true}
                            enableTilt={true}
                            clickEffect={true}
                            textAutoHide={false}
                            className="login-bento-grid"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
