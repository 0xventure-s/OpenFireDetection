import type { Metadata } from 'next';
import { PasswordChangeForm } from './password-change-form';

export const metadata: Metadata = {
  title: 'Nueva contraseña | OpenFireDetection',
};

export default function ChangePasswordPage() {
  return <PasswordChangeForm />;
}
