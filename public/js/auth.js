document.addEventListener('DOMContentLoaded', () => {
  const toggleButtons = document.querySelectorAll('.btn-password-toggle');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const inputId = button.getAttribute('aria-controls');
      const input = document.getElementById(inputId);
      
      if (!input) return;
      
      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');
      
      // Update aria-label
      button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      
      // Update icon
      const icon = button.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) {
          window.lucide.createIcons({
            icons: {
              Eye: window.lucide.icons.Eye,
              EyeOff: window.lucide.icons.EyeOff
            },
            nameAttr: 'data-lucide',
            attrs: {
              class: icon.className,
              'aria-hidden': 'true',
              style: icon.getAttribute('style')
            }
          });
        }
      }
    });
  });

  // Focus management: If there is an alert, focus it or its container so screen readers read it
  const alert = document.querySelector('.alert-danger');
  if (alert) {
    alert.setAttribute('tabindex', '-1');
    alert.focus();
  }
});
