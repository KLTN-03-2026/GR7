import React from 'react';
import { Link } from 'react-router-dom';
import VerifyEmailForm from '@/components/verifyEmail/verify-email-form';
import logo from '@/assets/logo2.png';
import ShinyText from '@/components/animations/ShinyText';
import { useTheme } from 'next-themes';

// Background image URL
const backgroundImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80';

const VerifyEmail = () => {
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
            <div className="min-h-screen relative z-10 flex flex-col justify-between p-6 md:p-10 lg:p-10 xl:p-12">
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
                    <div className="w-full max-w-2xl">
                        <VerifyEmailForm />
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground">
                    © 2026 EatEase. Trải nghiệm ẩm thực đẳng cấp.
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
