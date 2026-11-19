import { InfoCard } from '@/components/panel';
import { Screen } from '@/components/screen';
import { isRouteSport } from '@/domain/meetup';
import { levelName, sportName } from '@/domain/profile';
import { routeMark } from '@/domain/route-goals';
import { useMeetups } from '@/state/meetup-context';
import { useProfile } from '@/state/profile-context';

export default function GenteScreen() {
  const { profile } = useProfile();
  const { meetups } = useMeetups();

  return (
    <Screen title="Match" subtitle="Personas y grupos de Pasto con un ritmo y una distancia parecidos a los tuyos. Una salida muestra el lugar del plan, no el punto exacto de nadie.">
      {profile.sports.length === 0 ? (
        <InfoCard kicker="Tu perfil" title="Primero elige un deporte" body="Sin un deporte, I'm in no sabe con quién compararte." />
      ) : (
        profile.sports.map((sport) => {
          if (isRouteSport(sport.sportId)) {
            const mark = routeMark(meetups, sport.sportId);
            return <InfoCard key={sport.sportId} kicker={mark.label} title={sportName(sport.sportId)} body={mark.detail} />;
          }
          return (
            <InfoCard
              key={sport.sportId}
              kicker={levelName(sport.level) || 'Sin nivel'}
              title={sportName(sport.sportId)}
              body="Aún no hay personas con este nivel en Pasto. Cuando lleguen, las ves en esta tarjeta."
            />
          );
        })
      )}
    </Screen>
  );
}
