// src/core/database/user-manager.ts
import { BasicAuth, User } from '../auth/basic-auth';

// Simple in-memory storage for MVP (replace with database later)
interface UserStorage {
  [key: string]: User & { passwordHash: string };
}

export class UserManager {
  private auth: BasicAuth;
  private users: UserStorage = {};

  constructor() {
    this.auth = new BasicAuth();
    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers() {
    // Create default admin user for testing
    this.createUser('admin@orchestrall.com', 'admin123', 'admin');
  }

  async createUser(email: string, password: string, role: 'admin' | 'user' = 'user'): Promise<User> {
    // Check if user already exists
    if (this.users[email]) {
      throw new Error('User already exists');
    }

    const passwordHash = await this.auth.hashPassword(password);

    const user: User & { passwordHash: string } = {
      id: Date.now().toString(),
      email,
      role,
      createdAt: new Date(),
      passwordHash
    };

    this.users[email] = user;

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const user = this.users[email];

    if (!user) {
      return null;
    }

    const isValidPassword = await this.auth.verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return null;
    }

    const token = this.auth.generateAccessToken({
      userId: user.id,
      role: user.role
    });

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const user = Object.values(this.users).find(u => u.id === id);
    if (!user) return null;

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getAllUsers(): Promise<User[]> {
    return Object.values(this.users).map(({ passwordHash: _, ...user }) => user);
  }
}
