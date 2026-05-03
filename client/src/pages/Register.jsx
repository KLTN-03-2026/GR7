import { RegisterForm } from '@/components/register/register-form';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo2.png';
import ShinyText from '@/components/animations/ShinyText';
import { useTheme } from 'next-themes';
import MagicBento from '@/components/animations/MagicBento';

// Background image URL
const backgroundImage =
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80';

export default function RegisterPage() {
    const { theme } = useTheme();

    return (
        <div className="min-h-screen text-foreground transition-colors duration-300 overflow-hidden relative register-page">
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
                        backgroundColor:
                            theme === 'dark'
                                ? 'rgba(0, 0, 0, 0.6)'
                                : 'rgba(0, 0, 0, 0.3)',
                    }}
                />

                {/* Blur overlay layer */}
                <div
                    className="absolute inset-0"
                    style={{
                        backdropFilter: 'blur(8px)',
                        backgroundColor:
                            theme === 'dark'
                                ? 'rgba(0, 0, 0, 0.3)'
                                : 'rgba(255, 255, 255, 0.7)',
                    }}
                />
            </div>

            {/* Content */}
            <div className="grid lg:grid-cols-[35%_65%] min-h-screen relative z-10">
                {/* Left Side - Bento Grid with Header (30% - Desktop Only) */}
                <div className="hidden lg:flex flex-col justify-between py-8 px-6">
                    {/* Logo */}
                    <div>
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

                    {/* Bento Grid + Welcome Text */}
                    <div className="w-full flex-1 flex items-center justify-center py-6">
                        <div className="w-full mx-auto space-y-6">
                            {/* Welcome Text */}
                            <div className='px-8'>
                                <h1 className="text-3xl lg:text-4xl font-bold mb-3 leading-relaxed">
                                    <ShinyText
                                        text="Tạo tài khoản mới"
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
                                <p className="text-muted-foreground text-base">
                                    Bắt đầu hành trình ẩm thực của bạn cùng
                                    EatEase
                                </p>
                            </div>

                            <style>{`
                                /* Override login-bento-grid for Register page with 4 cards */
                                .register-page .login-bento-grid {
                                    display: grid;
                                    grid-template-columns: repeat(2, 1fr);
                                    grid-auto-rows: minmax(100px, auto);
                                    gap: 0.75rem;
                                }
                                
                                /* Card 1 - Tall left (row-span-2) */
                                .register-page .login-bento-grid > div:nth-child(1) {
                                    grid-row: span 2;
                                    min-height: 220px;
                                }
                                .register-page .login-bento-grid > div:nth-child(1) .bento-card__bg-image {
                                    opacity: 0.85 !important;
                                    background-size: cover !important;
                                    background-position: center !important;
                                }
                                .register-page .login-bento-grid > div:nth-child(1):hover .bento-card__bg-image {
                                    opacity: 1 !important;
                                }
                                
                                /* Card 2 - Top right (row-span-1) */
                                .register-page .login-bento-grid > div:nth-child(2) {
                                    grid-row: span 1;
                                    min-height: 105px;
                                }
                                
                                /* Card 3 - Bottom right (row-span-1) */
                                .register-page .login-bento-grid > div:nth-child(3) {
                                    grid-row: span 1;
                                    min-height: 105px;
                                }
                                
                                /* Card 4 - Full width bottom (col-span-2) */
                                .register-page .login-bento-grid > div:nth-child(4) {
                                    grid-column: span 2 !important;
                                    grid-row: span 1 !important;
                                    min-height: 140px;
                                    width: 100%;
                                }
                                
                                /* Make all images brighter */
                                .register-page .login-bento-grid .bento-card__bg-image {
                                    opacity: 0.65 !important;
                                }
                                .register-page .login-bento-grid .bento-card:hover .bento-card__bg-image {
                                    opacity: 0.85 !important;
                                }
                            `}</style>
                            <MagicBento
                                cards={[
                                    {
                                        image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
                                        span: 'col-span-1 row-span-2',
                                    },
                                    {
                                        image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
                                        span: 'col-span-1 row-span-1',
                                    },
                                    {
                                        image: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80',
                                        span: 'col-span-1 row-span-1',
                                    },
                                    {
                                        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
                                        span: 'col-span-2 row-span-2',
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

                {/* Right Side - Register Form (70%) */}
                <div className="flex flex-col justify-between p-6 md:p-10 lg:p-10 xl:p-0">
                    {/* Logo - Mobile Only */}
                    <div className="flex justify-start lg:hidden">
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
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-full max-w-2xl">
                            {/* Welcome Text - Mobile Only */}
                            <div className="mb-6 md:mb-8 lg:hidden">
                                <h1 className="text-3xl md:text-4xl font-bold mb-3 mt-10 leading-relaxed">
                                    <ShinyText
                                        text="Tạo tài khoản mới"
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
                                    Bắt đầu hành trình ẩm thực của bạn cùng
                                    EatEase
                                </p>
                            </div>

                            {/* Register Form */}
                            <RegisterForm />

                            {/* Footer */}
                            <div className="text-center text-sm text-muted-foreground mt-10">
                                © 2026 EatEase. Trải nghiệm ẩm thực đẳng cấp.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
