import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.CooperativeStickyAssignor;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.List;
import java.util.Map;

public class ConsumerDemoCooperative {

    private static final Logger log = LoggerFactory.getLogger(ConsumerDemoCooperative.class);

    public static void main(String[] args) {
        log.info("I am a Kafka Consumer with cooperative rebalance");

        String topic = "demo_java";

        Map<String, Object> config = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092",
                ConsumerConfig.GROUP_ID_CONFIG, "my-java-application",
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                // cooperative rebalance: при входе/выходе консьюмера двигаются только нужные партиции
                ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG, CooperativeStickyAssignor.class.getName()
                // static membership (у каждого экземпляра свой id!):
                // , ConsumerConfig.GROUP_INSTANCE_ID_CONFIG, "consumer-1"
        );

        try (var consumer = new KafkaConsumer<>(config, new StringDeserializer(), new StringDeserializer())) {

            Thread mainThread = Thread.currentThread();

            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                log.info("Detected a shutdown, let's exit by calling consumer.wakeup()...");
                consumer.wakeup();
                try {
                    mainThread.join();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));

            consumer.subscribe(List.of(topic));

            while (true) {
                var records = consumer.poll(Duration.ofMillis(1000));

                for (var record : records) {
                    log.info("key={} value={} partition={} offset={}",
                            record.key(), record.value(), record.partition(), record.offset());
                }
            }

        } catch (WakeupException e) {
            log.info("Consumer is starting to shut down");
        } catch (Exception e) {
            log.error("Unexpected exception in the consumer", e);
        }
        log.info("The consumer is now gracefully shut down");
    }
}
