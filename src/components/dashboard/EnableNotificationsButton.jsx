import { EnableNotificationsButton } from './EnableNotificationsButton';

function SettingsPage({ user }) {
  return (
    <div>
      {/* your existing settings content */}
      <section>
        <h3>Notifications</h3>
        <EnableNotificationsButton userId={user.id} />
      </section>
    </div>
  );
}