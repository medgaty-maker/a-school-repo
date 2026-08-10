export class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Пароль');
    this.submitButton = page.getByRole('button', { name: 'Войти' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  errorMessage() {
    return this.page.getByText('Invalid credentials');
  }
}