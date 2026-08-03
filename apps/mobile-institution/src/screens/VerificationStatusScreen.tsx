import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { colors, fonts, spacing } from '@/theme/tokens';

export function VerificationStatusScreen() {
  const { signOutUser } = useAuth();
  const { institution, loading } = useOwnInstitution();

  if (loading) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <Card style={{ gap: spacing[4] }}>
          <Text style={styles.title}>Estado de verificação</Text>
          {institution?.Verified ? (
            <>
              <Badge tone="success">Verificado</Badge>
              <Text style={styles.hint}>A sua instituição foi verificada.</Text>
            </>
          ) : institution?.Rejection_Reason ? (
            <>
              <Badge tone="danger">Rejeitado</Badge>
              <Text style={styles.hint}>{institution.Rejection_Reason}</Text>
              <Text style={styles.hint}>
                Se acredita que esta decisão foi um erro ou gostaria de fornecer informação
                adicional, contacte-nos em geral@zuinder.com.
              </Text>
            </>
          ) : (
            <>
              <Badge tone="warning">Por verificar</Badge>
              <Text style={styles.hint}>
                O seu registo está a aguardar aprovação do Admin. Isto pode demorar alguns dias.
              </Text>
            </>
          )}
          <Button variant="secondary" onPress={() => signOutUser()}>
            Sair
          </Button>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  hint: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
});
