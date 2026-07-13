export const dynamic = "force-dynamic";

/**
 * API endpoint for sending password reset email.
 * In a real implementation, this would integrate with your auth system.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!email) {
      return Response.json(
        { success: false, error: "Email is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // TODO: Implement actual password reset logic
    // This would typically:
    // 1. Generate a password reset token
    // 2. Store it in the database with an expiration
    // 3. Send an email with a reset link

    console.log(`[INFO] Password reset requested for user: ${userId}, email: ${email}`);

    // For now, simulate success
    // In production, integrate with your email service (SendGrid, SES, etc.)

    return Response.json(
      {
        success: true,
        message: `Password reset email sent to ${email}`
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/reset-password:", error);
    return Response.json(
      { success: false, error: "Failed to process password reset request" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
