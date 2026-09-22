import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </Svg>
  );
}

export default function SignInScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password states
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'REQUEST' | 'VERIFY' | 'SUCCESS'>('REQUEST');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow();
      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace('/(employee)/home');
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Google sign-in could not be completed. Please use Email & Password.';
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async () => {
    if (!isLoaded || !signIn) return;

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password: password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(employee)/home');
      } else if (result.status === 'needs_first_factor') {
        const factorRes = await signIn.attemptFirstFactor({
          strategy: 'password',
          password: password,
        });
        if (factorRes.status === 'complete') {
          await setActive({ session: factorRes.createdSessionId });
          router.replace('/(employee)/home');
        } else {
          setError('Authentication incomplete. Please check your credentials.');
        }
      } else {
        setError('Authentication incomplete. Please verify your credentials.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      const clerkMsg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Incorrect email or password. Please try again.';
      setError(clerkMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!isLoaded || !signIn || !resetEmail.trim()) return;

    setResetLoading(true);
    setResetError(null);

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: resetEmail.trim(),
      });
      setResetStep('VERIFY');
    } catch (err: any) {
      console.error('Password reset request error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Could not initiate password reset. Please contact your administrator.';
      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyPasswordReset = async () => {
    if (!isLoaded || !signIn || !resetCode.trim() || !newPassword) return;

    setResetLoading(true);
    setResetError(null);

    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: newPassword,
      });

      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        setResetStep('SUCCESS');
        setTimeout(() => {
          router.replace('/(employee)/home');
        }, 1500);
      } else {
        setResetError('Password reset incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('Password reset verify error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid reset code or password. Please try again.';
      setResetError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Brand Hero Section */}
          <View style={styles.brandHero}>
            <Image
              source={require('../../assets/skandan_logo.png')}
              style={styles.clinicLogo}
              resizeMode="contain"
            />
            <Text style={styles.eyebrow}>Skandan Home Carre Clinic LLP</Text>
            <Text style={styles.heroTitle}>Employee Management System</Text>
          </View>

          {/* Main Card */}
          <View style={styles.authCard}>
            {!showForgot ? (
              <View style={styles.formContainer}>
                {/* Header inside card */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Sign In</Text>
                  <Text style={styles.cardSubtitle}>
                    Sign in with your Google account or email & password
                  </Text>
                </View>

                {/* Error Banner */}
                {error && (
                  <View style={styles.errorBanner}>
                    <Feather name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 1 }} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Continue with Google */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  activeOpacity={0.8}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#0B2C8C" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>OR WITH EMAIL & PASSWORD</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Email Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Feather name="mail" size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="name@gmail.com"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        if (error) setError(null);
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Password Field */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowForgot(true);
                        setResetEmail(email);
                        setError(null);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputWrapper}>
                    <Feather name="lock" size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { paddingRight: 40 }]}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        if (error) setError(null);
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={18}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleLoginSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name="log-in" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryButtonText}>Sign In with Password</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Sign Up Link */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Don't have an account? </Text>
                  <Link href="/(auth)/sign-up" asChild>
                    <TouchableOpacity>
                      <Text style={styles.signUpLink}>Sign up</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            ) : (
              /* Forgot Password Flow */
              <View style={styles.formContainer}>
                <View style={styles.forgotHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForgot(false);
                      setResetStep('REQUEST');
                      setResetError(null);
                    }}
                    style={styles.backButton}
                  >
                    <Feather name="arrow-left" size={20} color="#6b7280" />
                  </TouchableOpacity>
                  <Text style={styles.cardTitle}>Reset Password</Text>
                </View>

                {resetError && (
                  <View style={styles.errorBanner}>
                    <Feather name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 1 }} />
                    <Text style={styles.errorText}>{resetError}</Text>
                  </View>
                )}

                {resetStep === 'REQUEST' && (
                  <>
                    <Text style={styles.cardSubtitle}>
                      Enter your email to receive a password reset code.
                    </Text>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email Address</Text>
                      <View style={styles.inputWrapper}>
                        <Feather name="mail" size={18} color="#6b7280" style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="name@gmail.com"
                          placeholderTextColor="#9ca3af"
                          value={resetEmail}
                          onChangeText={setResetEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryButton, resetLoading && styles.buttonDisabled]}
                      onPress={handleRequestPasswordReset}
                      disabled={resetLoading}
                      activeOpacity={0.85}
                    >
                      {resetLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {resetStep === 'VERIFY' && (
                  <>
                    <Text style={styles.cardSubtitle}>
                      Enter the verification code sent to {resetEmail} and your new password.
                    </Text>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Verification Code</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter 6-digit code"
                          placeholderTextColor="#9ca3af"
                          value={resetCode}
                          onChangeText={setResetCode}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>New Password</Text>
                      <View style={styles.inputWrapper}>
                        <Feather name="lock" size={18} color="#6b7280" style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="••••••••"
                          placeholderTextColor="#9ca3af"
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryButton, resetLoading && styles.buttonDisabled]}
                      onPress={handleVerifyPasswordReset}
                      disabled={resetLoading}
                      activeOpacity={0.85}
                    >
                      {resetLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Reset & Sign In</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {resetStep === 'SUCCESS' && (
                  <View style={styles.successContainer}>
                    <Feather name="check-circle" size={48} color="#10B981" />
                    <Text style={styles.successTitle}>Password Reset Successfully!</Text>
                    <Text style={styles.cardSubtitle}>Signing you in now...</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowForgot(false);
                    setResetStep('REQUEST');
                    setResetError(null);
                  }}
                  style={styles.cancelForgot}
                >
                  <Text style={styles.cancelForgotText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f3fb',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  clinicLogo: {
    width: 260,
    height: 60,
    marginBottom: 10,
  },
  eyebrow: {
    color: '#0B2C8C',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 13,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e0f0',
    padding: 24,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  formContainer: {
    gap: 16,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 18,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0B2C8C',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  inputIcon: {
    paddingLeft: 12,
    paddingRight: 4,
  },
  textInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B2C8C',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 6,
    shadowColor: '#0B2C8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
  },
  signUpLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B2C8C',
  },
  forgotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  cancelForgot: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelForgotText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 6,
  },
});
