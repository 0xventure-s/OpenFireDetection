import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Ingresar | OpenFireDetection',
};

export default function LoginPage() {
  return <LoginForm />;
}
