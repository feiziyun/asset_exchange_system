-- -----------------------------------------------
-- 1. 地区表
-- -----------------------------------------------
CREATE TABLE `region` (
                          `id`          INT         NOT NULL AUTO_INCREMENT              COMMENT '主键',
                          `region_key`  VARCHAR(20) NOT NULL                            COMMENT '地区标识，如 bj',
                          `region_name` VARCHAR(50) NOT NULL                            COMMENT '地区名称，如 北京',
                          `province`    VARCHAR(50) DEFAULT NULL                        COMMENT '所属省份',
                          `city`        VARCHAR(50) DEFAULT NULL                        COMMENT '城市名',
                          `sort_order`  INT         NOT NULL DEFAULT 0                  COMMENT '排序权重',
                          `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
                          PRIMARY KEY (`id`),
                          UNIQUE KEY `uk_region_key` (`region_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地区表';

INSERT INTO `region` (`region_key`, `region_name`, `province`, `city`, `sort_order`) VALUES
                                                                                         ('bj', '北京', '北京市', '北京市', 1),
                                                                                         ('sh', '上海', '上海市', '上海市', 2),
                                                                                         ('gz', '广州', '广东省', '广州市', 3),
                                                                                         ('sz', '深圳', '广东省', '深圳市', 4);


-- -----------------------------------------------
-- 2. 大类表
-- -----------------------------------------------
CREATE TABLE `asset_category` (
                                  `id`            INT          NOT NULL AUTO_INCREMENT             COMMENT '主键',
                                  `category_key`  VARCHAR(30)  NOT NULL                           COMMENT '大类标识，如 raw',
                                  `category_name` VARCHAR(50)  NOT NULL                           COMMENT '大类名称',
                                  `category_desc` VARCHAR(200) DEFAULT NULL                       COMMENT '大类描述',
                                  `sort_order`    INT          NOT NULL DEFAULT 0                 COMMENT '排序权重',
                                  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  PRIMARY KEY (`id`),
                                  UNIQUE KEY `uk_category_key` (`category_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产大类表';

INSERT INTO `asset_category` (`category_key`, `category_name`, `category_desc`, `sort_order`) VALUES
                                                                                                  ('raw',     '原始感知类',   '传感器/车端原始数据',      1),
                                                                                                  ('scene',   '场景事件类',   '可交易的场景与事件包',     2),
                                                                                                  ('struct',  '结构化指标类', '交通/时空统计要素',        3),
                                                                                                  ('derived', '衍生加工类',   '加工后的训练集与模型',     4);


-- -----------------------------------------------
-- 3. 子类表（原 sub_type 统一改为 sub_category）
-- -----------------------------------------------
CREATE TABLE `asset_sub_category` (
                                      `id`                INT          NOT NULL AUTO_INCREMENT             COMMENT '主键',
                                      `sub_category_key`  VARCHAR(40)  NOT NULL                           COMMENT '子类标识，如 raw_video',
                                      `sub_category_name` VARCHAR(50)  NOT NULL                           COMMENT '子类名称',
                                      `sub_category_desc` VARCHAR(200) DEFAULT NULL                       COMMENT '子类简介',
                                      `category_id`       INT          NOT NULL                           COMMENT '关联大类 ID',
                                      `sort_order`        INT          NOT NULL DEFAULT 0                 COMMENT '排序权重',
                                      `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      PRIMARY KEY (`id`),
                                      UNIQUE KEY `uk_sub_category_key` (`sub_category_key`),
                                      KEY `idx_category_id` (`category_id`),
                                      CONSTRAINT `fk_sub_category_category`
                                          FOREIGN KEY (`category_id`) REFERENCES `asset_category` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产子类表';

-- 原始感知类子类（category_id = 1）
INSERT INTO `asset_sub_category` (`sub_category_key`, `sub_category_name`, `sub_category_desc`, `category_id`, `sort_order`) VALUES
                                                                                                                                 ('raw_video',  '车端/路侧视频',      '脱敏后原始视频流',         1, 1),
                                                                                                                                 ('raw_lidar',  '激光雷达点云',       '高稀缺高价值点云原始包',   1, 2),
                                                                                                                                 ('raw_radar',  '毫米波/路侧雷达',    '雷达原始或融合感知数据',   1, 3),
                                                                                                                                 ('raw_traj',   '车辆轨迹与控制指令', '定位、轨迹、加速度等',     1, 4);

-- 场景事件类子类（category_id = 2）
INSERT INTO `asset_sub_category` (`sub_category_key`, `sub_category_name`, `sub_category_desc`, `category_id`, `sort_order`) VALUES
                                                                                                                                 ('scene_pkg',     '场景数据包',   '时间+空间切片索引资产',   2, 1),
                                                                                                                                 ('event_clip',    '事件数据资产', '急刹/碰撞/险情片段',      2, 2),
                                                                                                                                 ('rare_weather',  '稀缺天气场景', '雨雪/夜间/逆光等场景',    2, 3),
                                                                                                                                 ('game_scene',    '复杂博弈场景', '高交互密度场景库',        2, 4);

-- 结构化指标类子类（category_id = 3）
INSERT INTO `asset_sub_category` (`sub_category_key`, `sub_category_name`, `sub_category_desc`, `category_id`, `sort_order`) VALUES
                                                                                                                                 ('traffic_metrics', '交通指标数据集',   '速度/流量/占有率等统计', 3, 1),
                                                                                                                                 ('signal_state',    '信号灯时序状态',   '路口信控周期数据',       3, 2),
                                                                                                                                 ('lane_topo',       '车道拓扑道路几何', '道路结构化要素',         3, 3),
                                                                                                                                 ('junction_state',  '路口运行状态',     '排队/拥堵/通行效率',     3, 4);

-- 衍生加工类子类（category_id = 4）
INSERT INTO `asset_sub_category` (`sub_category_key`, `sub_category_name`, `sub_category_desc`, `category_id`, `sort_order`) VALUES
                                                                                                                                 ('labeled_pkg',   '标注训练数据包', 'OpenX/JSON 标准格式包',    4, 1),
                                                                                                                                 ('semantic_ds',   '语义标注数据集', '语义分割/检测标注结果',    4, 2),
                                                                                                                                 ('map_update',    '高精地图增量',   '新增/修改/删除地图要素',   4, 3),
                                                                                                                                 ('model_ver',     '模型版本资产',   '模型ID/性能摘要/授权策略', 4, 4),
                                                                                                                                 ('auth_contract', '授权合约资产',   '训练/仿真/商用权限合约',   4, 5);

-- -----------------------------------------------
-- 4. 资产主表
-- -----------------------------------------------
CREATE TABLE `digital_asset` (
    -- 主键
                                 `id`                     BIGINT        NOT NULL AUTO_INCREMENT              COMMENT '主键',

    -- 基础信息
                                 `asset_name`             VARCHAR(100)  NOT NULL DEFAULT ''                  COMMENT '资产名称',
                                 `brief`                  VARCHAR(300)  NOT NULL DEFAULT ''                  COMMENT '卡片摘要（短文本，用于列表展示）',
                                 `description`            TEXT          NOT NULL                             COMMENT '详细描述',
                                 `security_level`         TINYINT       NOT NULL DEFAULT 1                   COMMENT '安全等级：1/2/3',
                                 `assetgrade`             VARCHAR(20)   NOT NULL DEFAULT '一般数据'        COMMENT '数据来源评级：一般数据/重要数据/核心数据',

    -- 分类与地区
                                 `category_id`            INT           NOT NULL DEFAULT 0                   COMMENT '关联大类 ID',
                                 `category_key`           VARCHAR(30)   NOT NULL DEFAULT ''                  COMMENT '大类标识（冗余）',
                                 `sub_type_id`            INT           NOT NULL DEFAULT 0                   COMMENT '关联子类 ID',
                                 `sub_type_key`           VARCHAR(40)   NOT NULL DEFAULT ''                  COMMENT '子类标识（冗余）',
                                 `region_id`              INT           NOT NULL DEFAULT 0                   COMMENT '关联地区 ID',
                                 `region_key`             VARCHAR(20)   NOT NULL DEFAULT ''                  COMMENT '地区标识（冗余）',

    -- 文件与哈希
                                 `file_hash`              VARCHAR(128)  NOT NULL DEFAULT ''                  COMMENT '文件哈希值（全局唯一）',
                                 `hash_algorithm`         VARCHAR(30)   NOT NULL DEFAULT 'SHA2_256'          COMMENT '哈希算法：SHA2_256/SHA3_256/其他',
                                 `cover_image_url`        VARCHAR(500)  NOT NULL DEFAULT ''                  COMMENT '预览图可访问 URL',
                                 `file_size`              BIGINT        NOT NULL DEFAULT 0                   COMMENT '文件大小（字节）',
                                 `file_format`            VARCHAR(30)   NOT NULL DEFAULT ''                  COMMENT '文件格式，如 mp4、pcd、json',

    -- 链上信息
                                 `token_id`               VARCHAR(128)  NOT NULL DEFAULT ''                  COMMENT '链上 Token ID',
                                 `owner_address`          VARCHAR(128)  NOT NULL DEFAULT ''                  COMMENT '当前持有者链上地址',
                                 `chain_tx_hash`          VARCHAR(128)  NOT NULL DEFAULT ''                  COMMENT '上链交易哈希',
                                 `chain_status`           TINYINT       NOT NULL DEFAULT 0                   COMMENT '链上状态：0=待上链，1=已上链，2=失败',

    -- 价格与数量
                                 `price`                  DECIMAL(18,6) NOT NULL DEFAULT 0.000000            COMMENT '资产价格',
                                 `price_unit`             VARCHAR(10)   NOT NULL DEFAULT 'ETH'               COMMENT '价格单位',
                                 `quantity`               INT           NOT NULL DEFAULT 1                   COMMENT '资产总数量',
                                 `remaining_qty`          INT           NOT NULL DEFAULT 1                   COMMENT '剩余可售数量',
                                 `is_divisible`           TINYINT(1)    NOT NULL DEFAULT 0                   COMMENT '是否可分割：0=否，1=是',

    -- 权限控制
                                 `can_sell_ownership`     TINYINT(1)    NOT NULL DEFAULT 0                   COMMENT '允许出售所有权：0=否，1=是',
                                 `can_sell_view_right`    TINYINT(1)    NOT NULL DEFAULT 0                   COMMENT '允许出售查阅权：0=否，1=是',
                                 `can_sell_process_right` TINYINT(1)    NOT NULL DEFAULT 0                   COMMENT '允许出售加工权：0=否，1=是',
                                 `allow_resale`           TINYINT       NOT NULL DEFAULT 0                   COMMENT '二次交易：0=不允许，1=需管理员审批，2=直接允许',
                                 `is_proxied`             TINYINT(1)    NOT NULL DEFAULT 0                   COMMENT '是否允许授权给他人：0=否，1=是',
                                 `is_third_party`         TINYINT(1)    NOT NULL DEFAULT 0                   COMMENT '是否允许第三方监管：0=否，1=是',

    -- 交易时间与地点限制
                                 `trade_region`           VARCHAR(100)  NOT NULL DEFAULT ''                  COMMENT '允许交易地点（省-市-区）',
                                 `trade_start_time`       TIME          NOT NULL DEFAULT '00:00:00'          COMMENT '允许交易开始时间',
                                 `trade_end_time`         TIME          NOT NULL DEFAULT '23:59:59'          COMMENT '允许交易结束时间',

    -- 采集元信息
                                 `collect_time_start`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP   COMMENT '数据采集开始时间',
                                 `collect_time_end`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP   COMMENT '数据采集结束时间',
                                 `collect_location`       VARCHAR(200)  NOT NULL DEFAULT ''                  COMMENT '采集地点描述',
                                 `sensor_type`            VARCHAR(100)  NOT NULL DEFAULT ''                  COMMENT '传感器类型，如 激光雷达+摄像头',
                                 `data_volume`            VARCHAR(50)   NOT NULL DEFAULT ''                  COMMENT '数据规模描述，如 2TB / 10万帧',

    -- 用户与证书
                                 `user_id`                BIGINT        NOT NULL DEFAULT 0                   COMMENT '登记用户 ID',
                                 `email`                  VARCHAR(100)  NOT NULL DEFAULT ''                  COMMENT '联系邮箱',
                                 `certificate_name`       VARCHAR(100)  NOT NULL DEFAULT ''                  COMMENT '使用的证书名称',

    -- 状态与统计
                                 `status`                 TINYINT       NOT NULL DEFAULT 1                   COMMENT '状态：0=下架，1=上架中，2=已售罄',
                                 `view_count`             INT           NOT NULL DEFAULT 0                   COMMENT '浏览次数',
                                 `trade_count`            INT           NOT NULL DEFAULT 0                   COMMENT '成交次数',

    -- 时间戳
                                 `created_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP             COMMENT '创建时间',
                                 `updated_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP                    COMMENT '最后更新时间',

                                 PRIMARY KEY (`id`),
                                 UNIQUE KEY `uk_file_hash`      (`file_hash`),
                                 UNIQUE KEY `uk_token_id`       (`token_id`),
                                 KEY `idx_category_key`         (`category_key`),
                                 KEY `idx_sub_type_key`         (`sub_type_key`),
                                 KEY `idx_region_key`           (`region_key`),
                                 KEY `idx_user_id`              (`user_id`),
                                 KEY `idx_status`               (`status`),
                                 KEY `idx_assetgrade`           (`assetgrade`),
                                 KEY `idx_created_at`           (`created_at`),
                                 CONSTRAINT `fk_asset_category` FOREIGN KEY (`category_id`)
                                     REFERENCES `asset_category` (`id`) ON DELETE RESTRICT,
                                 CONSTRAINT `fk_asset_sub_type` FOREIGN KEY (`sub_type_id`)
                                     REFERENCES `asset_sub_category` (`id`) ON DELETE RESTRICT,
                                 CONSTRAINT `fk_asset_region`   FOREIGN KEY (`region_id`)
                                     REFERENCES `region` (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动驾驶数字资产主表';
