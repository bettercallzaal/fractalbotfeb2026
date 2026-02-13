import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      discordId?: string
      walletAddress?: string | null
      totalFractals?: number
      totalWins?: number
    }
  }

  interface User {
    id: string
    discordId?: string
    walletAddress?: string | null
    totalFractals?: number
    totalWins?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string
  }
}
