/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif']
            },
            boxShadow: {
                soft: '0 20px 60px rgba(9, 14, 27, 0.18)'
            },
            colors: {
                ink: {
                    50: '#f6f7fb',
                    100: '#eceef5',
                    200: '#d6dceb',
                    300: '#afb9d0',
                    400: '#7f8bab',
                    500: '#596683',
                    600: '#3f4a64',
                    700: '#31384f',
                    800: '#1f2537',
                    900: '#111627'
                },
                gold: {
                    400: '#ffcc66',
                    500: '#f5b942',
                    600: '#d79b1c'
                },
                coral: {
                    400: '#ff8d7a',
                    500: '#f46858'
                }
            }
        }
    },
    plugins: []
};
