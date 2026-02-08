import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUserStore, BACKEND_URL } from "../../stores/useUserStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../ui/card";
import { Textarea } from "../ui/textarea";
import { Loader2, Mail, Key, Github, Ticket, User } from "lucide-react";

export function LoginGate({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, login, loginWithEmail, registerWithEmail, submitAccessRequest, setUser } = useUserStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form States
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");

    // Application Form States
    const [applicationReason, setApplicationReason] = useState("");
    const [applicationSent, setApplicationSent] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState("login");
    const [showGoogleInvite, setShowGoogleInvite] = useState(false);
    const [showApplicationForm, setShowApplicationForm] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await login(showGoogleInvite ? inviteCode : undefined);
        } catch (err: any) {
            console.error("Google Login Error:", err);

            if (err.message === 'INVITE_REQUIRED') {
                setShowGoogleInvite(true);
                setError("Invite code required for new Google users.");
            } else if (err.message === 'INVALID_INVITE_CODE') {
                setError("Invalid or used invite code.");
            } else {
                setError(err.message || "Google login failed.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGithubLogin = () => {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        console.log("Opening GitHub login popup:", `${BACKEND_URL}/api/auth/github`);
        const popup = window.open(
            `${BACKEND_URL}/api/auth/github`,
            'github_login',
            `width=${width},height=${height},top=${top},left=${left}`
        );

        if (!popup) {
            alert("Please allow popups for this website to sign in with GitHub.");
            return;
        }

        const handleMessage = (event: MessageEvent) => {
            // In production, verify event.origin matches BACKEND_URL's origin
            // if (event.origin !== new URL(BACKEND_URL).origin) return; 

            if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
                const { token, user } = event.data;
                setUser(user, token);
                if (popup) popup.close();
                window.removeEventListener('message', handleMessage);
            }
        };

        window.addEventListener('message', handleMessage);
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await loginWithEmail(email, password);
        } catch (err: any) {
            console.error("Email Login Error:", err);
            setError(err.message || "Login failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!inviteCode) {
            setError("Invite code is required for registration.");
            setIsLoading(false);
            return;
        }

        try {
            await registerWithEmail(email, password, inviteCode);
        } catch (err: any) {
            console.error("Registration Error:", err);
            if (err.message === 'INVITE_REQUIRED') {
                setError("Invite code is required.");
            } else if (err.message === 'INVALID_INVITE_CODE') {
                setError("Invalid or used invite code.");
            } else {
                setError(err.message || "Registration failed.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplicationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!email || !applicationReason) {
            setError("Email and reason are required.");
            setIsLoading(false);
            return;
        }

        try {
            await submitAccessRequest(email, applicationReason);
            setApplicationSent(true);
        } catch (err: any) {
            console.error("Application Error:", err);
            setError(err.message || "Submission failed.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="relative w-full h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/20 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

            <motion.div
                layout
                className="relative z-10 w-full max-w-[400px]"
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
            >
                <div className="text-center mb-6">
                    <div className="flex flex-col items-center justify-center pt-2 pb-0 opacity-100 hover:opacity-70 transition-all duration-300">
                        <img src="/topoo_text_gray.png" alt="Topoo Gateway" className="h-14 w-auto" />
                    </div>
                </div>

                <AnimatePresence mode="popLayout">
                    {showApplicationForm ? (
                        <motion.div
                            key="application"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            layout
                        >
                            <Card className="w-full min-h-[360px] flex flex-col">
                                <CardHeader className="pb-2 pt-4 space-y-1">
                                    <CardTitle className="text-base leading-none">
                                        {applicationSent ? "Application Received" : "Apply for Access"}
                                    </CardTitle>
                                    <CardDescription className="text-xs leading-tight">
                                        {applicationSent
                                            ? "We've received your request. We'll be in touch soon!"
                                            : "Limited spots available. Submit your request below."}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col justify-between space-y-3">
                                    {applicationSent ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 flex-1">
                                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <p className="text-sm text-muted-foreground">Check your email for updates.</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleApplicationSubmit} className="flex-1 flex flex-col justify-between h-full space-y-3">
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label htmlFor="app-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                                                    <div className="relative">
                                                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            id="app-name"
                                                            type="text"
                                                            placeholder="John Doe"
                                                            className="pl-8 h-8 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="app-email" className="text-xs font-medium text-muted-foreground">Email Address</Label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            id="app-email"
                                                            type="email"
                                                            placeholder="name@example.com"
                                                            className="pl-8 h-8 text-xs"
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="reason" className="text-xs font-medium text-muted-foreground">How did you hear about us?</Label>
                                                    <Textarea
                                                        id="reason"
                                                        placeholder="Social media, friend, blog post, etc..."
                                                        className="min-h-[120px] text-xs py-2"
                                                        value={applicationReason}
                                                        onChange={(e) => setApplicationReason(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {error && (
                                                    <div className="p-2 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium">
                                                        {error}
                                                    </div>
                                                )}

                                                <Button type="submit" className="w-full h-8 text-xs" disabled={isLoading}>
                                                    {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                                                    Submit Application
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </CardContent>
                                <CardFooter className="flex justify-center pb-2 pt-0">
                                    <Button variant="ghost" className="text-xs text-muted-foreground h-8" onClick={() => setShowApplicationForm(false)}>
                                        Back to Login
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            layout
                        >
                            <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="login">Login</TabsTrigger>
                                    <TabsTrigger value="register">Register</TabsTrigger>
                                </TabsList>

                                <TabsContent value="login" asChild>
                                    <div className="mt-0">
                                        <Card className="w-full min-h-[360px] flex flex-col">
                                            <CardHeader className="pb-2 pt-4 space-y-1">
                                                <CardTitle className="text-base leading-none">Welcome back</CardTitle>
                                                <CardDescription className="text-xs leading-tight">
                                                    Enter your credentials to access your account.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-1 flex flex-col justify-between space-y-3">
                                                <form onSubmit={handleEmailLogin} className="space-y-2">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                            <Input
                                                                id="email"
                                                                type="email"
                                                                placeholder="name@example.com"
                                                                className="pl-8 h-8 text-xs"
                                                                value={email}
                                                                onChange={(e) => setEmail(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                                                        <div className="relative">
                                                            <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                            <Input
                                                                id="password"
                                                                type="password"
                                                                className="pl-8 h-8 text-xs"
                                                                value={password}
                                                                onChange={(e) => setPassword(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    {error && (
                                                        <div className="p-2 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium">
                                                            {error}
                                                        </div>
                                                    )}

                                                    <Button type="submit" className="w-full h-8 text-xs" disabled={isLoading}>
                                                        {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                                                        Sign In
                                                    </Button>
                                                </form>

                                                <div className="space-y-3">
                                                    <div className="relative">
                                                        <div className="absolute inset-0 flex items-center">
                                                            <span className="w-full border-t" />
                                                        </div>
                                                        <div className="relative flex justify-center text-xs">
                                                            <span className="bg-background px-2 text-muted-foreground">
                                                                Or continue with
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-3">
                                                        <Button variant="outline" className="w-full h-8 text-xs" onClick={handleGoogleLogin} disabled={isLoading}>
                                                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                                                            Continue with Google
                                                        </Button>
                                                        <Button variant="outline" className="w-full h-8 text-xs" onClick={handleGithubLogin} disabled={isLoading}>
                                                            <Github className="mr-2 h-4 w-4" />
                                                            Continue with GitHub
                                                        </Button>
                                                    </div>

                                                    {showGoogleInvite && (
                                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2">
                                                            <div className="flex justify-between items-center">
                                                                <Label htmlFor="google-invite">Invite Code Required</Label>
                                                                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setShowApplicationForm(true)}>
                                                                    No code?
                                                                </Button>
                                                            </div>
                                                            <div className="flex flex-col items-center justify-center pt-2 pb-0 opacity-100 hover:opacity-70 transition-all duration-300">
                                                                <img src="/topoo_text_gray.png" alt="Topoo Gateway" className="h-11 w-auto" />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    id="google-invite"
                                                                    placeholder="Enter invite code"
                                                                    value={inviteCode}
                                                                    onChange={(e) => setInviteCode(e.target.value)}
                                                                    className="bg-accent/20"
                                                                />
                                                                <Button onClick={handleGoogleLogin} size="sm">
                                                                    Go
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <TabsContent value="register" asChild>
                                    <div className="mt-0">
                                        <Card className="w-full min-h-[360px] flex flex-col">
                                            <CardHeader className="pb-2 pt-4 space-y-1">
                                                <CardTitle className="text-base leading-none">Create an account</CardTitle>
                                                <CardDescription className="text-xs leading-tight">
                                                    Enter your details to create a new account.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-1 flex flex-col justify-between space-y-3">
                                                <form onSubmit={handleRegister} className="flex-1 flex flex-col justify-between h-full space-y-2">
                                                    <div className="space-y-2">
                                                        <div className="space-y-1">
                                                            <Label htmlFor="reg-email" className="text-xs font-medium text-muted-foreground">Email</Label>
                                                            <div className="relative">
                                                                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                                <Input
                                                                    id="reg-email"
                                                                    type="email"
                                                                    placeholder="name@example.com"
                                                                    className="pl-8 h-8 text-xs"
                                                                    value={email}
                                                                    onChange={(e) => setEmail(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label htmlFor="reg-password" className="text-xs font-medium text-muted-foreground">Password</Label>
                                                            <div className="relative">
                                                                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                                <Input
                                                                    id="reg-password"
                                                                    type="password"
                                                                    className="pl-8 h-8 text-xs"
                                                                    value={password}
                                                                    onChange={(e) => setPassword(e.target.value)}
                                                                    required
                                                                    minLength={6}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label htmlFor="invite-code" className="text-xs font-medium text-muted-foreground">Invite Code</Label>
                                                                <Button variant="link" className="h-auto p-0 text-[10px]" onClick={() => setShowApplicationForm(true)}>
                                                                    Apply for beta access
                                                                </Button>
                                                            </div>
                                                            <div className="relative">
                                                                <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                                <Input
                                                                    id="invite-code"
                                                                    placeholder="Required for registration"
                                                                    className="pl-8 h-8 text-xs"
                                                                    value={inviteCode}
                                                                    onChange={(e) => setInviteCode(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground text-right">
                                                                Mandatory for new signups
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {error && (
                                                            <div className="p-2 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium">
                                                                {error}
                                                            </div>
                                                        )}

                                                        <Button type="submit" className="w-full h-8 text-xs" disabled={isLoading}>
                                                            {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                                                            Create Account
                                                        </Button>
                                                    </div>
                                                </form>
                                            </CardContent>
                                            <CardFooter className="flex justify-center pb-2 pt-0">
                                                <Button variant="link" className="text-xs text-muted-foreground h-auto" onClick={() => setActiveTab("login")}>
                                                    Already have an account? Sign In
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="mt-4 text-center text-[10px] leading-3 text-muted-foreground/80 tracking-tight">
                    By clicking continue, you agree to our{" "}
                    <a href="#" className="underline hover:text-primary">Terms of Service</a>{" "}
                    and{" "}
                    <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
                </p>
            </motion.div>
        </div>
    );
}
