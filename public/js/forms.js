document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      // If form is already submitting, prevent default
      if (form.dataset.submitting) {
        e.preventDefault();
        return;
      }
      
      // Some forms might have their own custom submit handling (like search-book)
      // which we don't want to break if they do their own button disabling
      // But we can globally mark the form as submitting
      if (form.checkValidity && !form.checkValidity()) {
        return; // Let browser show validation errors
      }
      
      form.dataset.submitting = 'true';
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.disabled = true;
        // Optional: change text to 'Submitting...' or show spinner if not already done
        if (!submitBtn.innerHTML.includes('spinner')) {
          const originalText = submitBtn.innerHTML;
          submitBtn.dataset.originalText = originalText;
          // Just disable it to prevent double clicks
        }
      }
    });
  });
});
